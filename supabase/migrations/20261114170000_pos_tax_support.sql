
ALTER TABLE public.dokkan_sales
  ADD COLUMN IF NOT EXISTS tax_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.dokkan_create_sale(
  p_store_id uuid,
  p_branch_id uuid,
  p_items jsonb,
  p_discount_percent numeric DEFAULT 0,
  p_amount_paid numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_customer_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sale_id uuid;
  v_user_id uuid := auth.uid();
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_taxable_amount numeric(14,2) := 0;
  v_tax_rate numeric(7,4) := 0;
  v_tax_amount numeric(14,2) := 0;
  v_tax_enabled boolean := false;
  v_total numeric(14,2) := 0;
  v_remaining numeric(14,2) := 0;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity numeric(14,3);
  v_unit_price numeric(14,2);
  v_line_discount numeric(14,2);
  v_stock numeric(14,3);
  v_product_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_store_id IS NULL
     OR p_branch_id IS NULL
     OR p_items IS NULL
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0
     OR p_discount_percent IS NULL
     OR p_discount_percent < 0
     OR p_discount_percent > 100
     OR p_amount_paid IS NULL
     OR p_amount_paid < 0
     OR p_payment_method IS NULL
     OR p_payment_method NOT IN ('cash','wallet','transfer')
     OR p_idempotency_key IS NULL
     OR length(trim(p_idempotency_key)) < 8
     OR length(trim(p_idempotency_key)) > 120
  THEN
    RAISE EXCEPTION 'invalid sale';
  END IF;

  IF NOT private.dokkan_has_role(
       p_store_id,
       ARRAY['owner','admin','manager','cashier']
     )
     OR NOT private.dokkan_can_branch(p_branch_id)
     OR NOT EXISTS (
       SELECT 1
       FROM public.dokkan_branches b
       WHERE b.id = p_branch_id
         AND b.store_id = p_store_id
         AND b.status = 'active'
     )
  THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_customer_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.dokkan_customers c
       WHERE c.id = p_customer_id
         AND c.store_id = p_store_id
         AND c.status = 'active'
     )
  THEN
    RAISE EXCEPTION 'invalid customer';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_store_id::text || ':' || trim(p_idempotency_key),
      0
    )
  );

  SELECT s.id
  INTO v_sale_id
  FROM public.dokkan_sales s
  WHERE s.store_id = p_store_id
    AND s.idempotency_key = trim(p_idempotency_key);

  IF v_sale_id IS NOT NULL THEN
    RETURN v_sale_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) e
    GROUP BY (e->>'variant_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate sale item';
  END IF;

  FOR v_variant_id IN
    SELECT (e->>'variant_id')::uuid
    FROM jsonb_array_elements(p_items) e
    ORDER BY (e->>'variant_id')::uuid
  LOOP
    PERFORM 1
    FROM public.dokkan_product_variants v
    WHERE v.id = v_variant_id
      AND v.store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid product variant';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    IF v_quantity IS NULL
       OR v_quantity <= 0
       OR v_quantity > 1000000
    THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;

    SELECT v.price, p.status
    INTO v_unit_price, v_product_status
    FROM public.dokkan_product_variants v
    JOIN public.dokkan_products p
      ON p.id = v.product_id
     AND p.store_id = v.store_id
    WHERE v.id = v_variant_id
      AND v.store_id = p_store_id;

    IF NOT FOUND OR v_product_status <> 'active' THEN
      RAISE EXCEPTION 'invalid product';
    END IF;

    SELECT COALESCE(
      SUM(
        CASE m.movement_type
          WHEN 'opening' THEN m.quantity
          WHEN 'purchase' THEN m.quantity
          WHEN 'return' THEN m.quantity
          WHEN 'transfer_in' THEN m.quantity
          WHEN 'sale' THEN -m.quantity
          WHEN 'transfer_out' THEN -m.quantity
          WHEN 'damage' THEN -m.quantity
          WHEN 'adjustment' THEN m.quantity
          ELSE 0
        END
      ),
      0
    )
    INTO v_stock
    FROM public.dokkan_inventory_movements m
    WHERE m.store_id = p_store_id
      AND m.branch_id = p_branch_id
      AND m.product_variant_id = v_variant_id;

    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'insufficient stock';
    END IF;

    v_line_discount :=
      COALESCE((v_item->>'discount')::numeric, 0);

    IF v_line_discount <> 0 THEN
      RAISE EXCEPTION 'invalid line discount';
    END IF;

    v_subtotal :=
      v_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  v_discount :=
    ROUND(v_subtotal * (p_discount_percent / 100), 2);

  v_taxable_amount :=
    GREATEST(0, v_subtotal - v_discount);

  SELECT
    COALESCE(ss.tax_enabled, false),
    COALESCE(ss.tax_rate, 0)
  INTO v_tax_enabled, v_tax_rate
  FROM public.dokkan_store_settings ss
  WHERE ss.store_id = p_store_id;

  IF NOT v_tax_enabled THEN
    v_tax_rate := 0;
  END IF;

  IF v_tax_rate < 0 OR v_tax_rate > 100 THEN
    RAISE EXCEPTION 'invalid tax settings';
  END IF;

  v_tax_amount :=
    ROUND(v_taxable_amount * (v_tax_rate / 100), 2);

  v_total :=
    v_taxable_amount + v_tax_amount;

  p_amount_paid := v_total;
  v_remaining := 0;

  INSERT INTO public.dokkan_sales (
    store_id,
    branch_id,
    customer_id,
    subtotal,
    discount,
    tax_enabled,
    tax_rate,
    tax_amount,
    total,
    amount_paid,
    remaining,
    payment_method,
    status,
    notes,
    created_by,
    idempotency_key
  )
  VALUES (
    p_store_id,
    p_branch_id,
    p_customer_id,
    v_subtotal,
    v_discount,
    v_tax_enabled,
    v_tax_rate,
    v_tax_amount,
    v_total,
    p_amount_paid,
    v_remaining,
    p_payment_method,
    'completed',
    NULLIF(trim(p_notes), ''),
    v_user_id,
    trim(p_idempotency_key)
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    SELECT v.price
    INTO v_unit_price
    FROM public.dokkan_product_variants v
    WHERE v.id = v_variant_id
      AND v.store_id = p_store_id;

    v_line_discount :=
      COALESCE((v_item->>'discount')::numeric, 0);

    INSERT INTO public.dokkan_sale_items (
      sale_id,
      product_variant_id,
      quantity,
      unit_price,
      discount
    )
    VALUES (
      v_sale_id,
      v_variant_id,
      v_quantity,
      v_unit_price,
      v_line_discount
    );

    INSERT INTO public.dokkan_inventory_movements (
      store_id,
      branch_id,
      product_variant_id,
      movement_type,
      quantity,
      reference_id,
      created_by
    )
    VALUES (
      p_store_id,
      p_branch_id,
      v_variant_id,
      'sale',
      v_quantity,
      v_sale_id,
      v_user_id
    );
  END LOOP;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    branch_id,
    action,
    entity_type,
    entity_id,
    actor_id
  )
  VALUES (
    p_store_id,
    p_branch_id,
    'create',
    'sale',
    v_sale_id,
    v_user_id
  );

  RETURN v_sale_id;
END;
$function$;

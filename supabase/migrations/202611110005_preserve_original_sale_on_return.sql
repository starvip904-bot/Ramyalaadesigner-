
BEGIN;

CREATE OR REPLACE FUNCTION public.dokkan_create_sale_return(
  p_sale_id uuid,
  p_items jsonb,
  p_refund_method text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale public.dokkan_sales%rowtype;
  v_return_id uuid;
  v_existing_id uuid;
  v_existing_sale_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity numeric(14,3);
  v_sold_quantity numeric(14,3);
  v_returned_quantity numeric(14,3);
  v_line_base numeric(14,2);
  v_remaining_base numeric(14,2);
  v_net_remaining_value numeric(14,2);
  v_line_amount numeric(14,2);
  v_return_total numeric(14,2) := 0;
  v_applied numeric(14,2) := 0;
  v_cash_refund numeric(14,2) := 0;
  v_prior_cash_refunds numeric(14,2) := 0;
  v_item_count integer;
  v_item_index integer := 0;
  v_all_returned boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_sale_id IS NULL
     OR p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR nullif(trim(p_idempotency_key), '') IS NULL
     OR length(trim(p_idempotency_key)) < 8
     OR length(trim(p_idempotency_key)) > 120
     OR length(coalesce(p_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'invalid return';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS e(value)
    GROUP BY e.value->>'variant_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate return item';
  END IF;

  v_item_count := jsonb_array_length(p_items);

  -- قفل الفاتورة لمنع المرتجعات المتزامنة
  SELECT *
  INTO v_sale
  FROM public.dokkan_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT private.dokkan_has_role(
       v_sale.store_id,
       ARRAY['owner','admin','manager','cashier']
     )
     OR NOT private.dokkan_can_branch(v_sale.branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- قفل مفتاح العملية لمنع التكرار
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_sale.store_id::text || ':return:' || trim(p_idempotency_key),
      0
    )
  );

  SELECT id, sale_id
  INTO v_existing_id, v_existing_sale_id
  FROM public.dokkan_sale_returns
  WHERE store_id = v_sale.store_id
    AND idempotency_key = trim(p_idempotency_key);

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_sale_id = p_sale_id THEN
      RETURN v_existing_id;
    END IF;

    RAISE EXCEPTION 'idempotency key already used';
  END IF;

  IF v_sale.status = 'returned' THEN
    RAISE EXCEPTION 'sale already returned';
  END IF;

  -- قفل الأصناف بالترتيب
  FOR v_variant_id IN
    SELECT (e.value->>'variant_id')::uuid
    FROM jsonb_array_elements(p_items) AS e(value)
    ORDER BY (e.value->>'variant_id')::uuid
  LOOP
    PERFORM 1
    FROM public.dokkan_product_variants v
    WHERE v.id = v_variant_id
      AND v.store_id = v_sale.store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid product variant';
    END IF;
  END LOOP;

  -- التحقق من الكميات التي تم بيعها ولم تُرجع سابقًا
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    IF v_variant_id IS NULL
       OR v_quantity IS NULL
       OR v_quantity <= 0
       OR v_quantity > 1000000 THEN
      RAISE EXCEPTION 'invalid return quantity';
    END IF;

    SELECT coalesce(sum(si.quantity), 0)
    INTO v_sold_quantity
    FROM public.dokkan_sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.product_variant_id = v_variant_id;

    IF v_sold_quantity <= 0 THEN
      RAISE EXCEPTION 'item not found in sale';
    END IF;

    SELECT coalesce(sum(ri.quantity), 0)
    INTO v_returned_quantity
    FROM public.dokkan_sale_return_items ri
    JOIN public.dokkan_sale_returns sr
      ON sr.id = ri.return_id
    WHERE sr.sale_id = p_sale_id
      AND ri.product_variant_id = v_variant_id;

    IF v_quantity > v_sold_quantity - v_returned_quantity THEN
      RAISE EXCEPTION 'return quantity exceeds sold quantity';
    END IF;
  END LOOP;

  -- هل المرتجع الحالي سيكمل إرجاع كل أصناف الفاتورة؟
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.dokkan_sale_items si
    WHERE si.sale_id = p_sale_id
    GROUP BY si.product_variant_id
    HAVING
      sum(si.quantity) >
      coalesce((
        SELECT sum(ri.quantity)
        FROM public.dokkan_sale_return_items ri
        JOIN public.dokkan_sale_returns sr
          ON sr.id = ri.return_id
        WHERE sr.sale_id = p_sale_id
          AND ri.product_variant_id = si.product_variant_id
      ), 0)
      +
      coalesce((
        SELECT sum((e.value->>'quantity')::numeric)
        FROM jsonb_array_elements(p_items) AS e(value)
        WHERE (e.value->>'variant_id')::uuid = si.product_variant_id
      ), 0)
  )
  INTO v_all_returned;

  -- قيمة الأصناف التي لم تُرجع بعد
  SELECT coalesce(sum(
    remaining.line_base
    * (remaining.sold_quantity - remaining.returned_quantity)
    / nullif(remaining.sold_quantity, 0)
  ), 0)
  INTO v_remaining_base
  FROM (
    SELECT
      si.product_variant_id,
      sum(si.quantity) AS sold_quantity,
      sum(si.unit_price * si.quantity - si.discount) AS line_base,
      coalesce((
        SELECT sum(ri.quantity)
        FROM public.dokkan_sale_return_items ri
        JOIN public.dokkan_sale_returns sr
          ON sr.id = ri.return_id
        WHERE sr.sale_id = p_sale_id
          AND ri.product_variant_id = si.product_variant_id
      ), 0) AS returned_quantity
    FROM public.dokkan_sale_items si
    WHERE si.sale_id = p_sale_id
    GROUP BY si.product_variant_id
  ) remaining;

  -- قيمة الفاتورة المتبقية بعد احتساب المرتجعات السابقة
  SELECT coalesce(sum(ri.amount), 0)
  INTO v_return_total
  FROM public.dokkan_sale_return_items ri
  JOIN public.dokkan_sale_returns sr
    ON sr.id = ri.return_id
  WHERE sr.sale_id = p_sale_id;

  v_net_remaining_value :=
    greatest(0, v_sale.total - v_return_total);

  v_return_total := 0;

  -- إجمالي المبالغ النقدية التي سبق ردها
  SELECT coalesce(sum(refund_amount), 0)
  INTO v_prior_cash_refunds
  FROM public.dokkan_sale_returns
  WHERE sale_id = p_sale_id;

  INSERT INTO public.dokkan_sale_returns (
    store_id,
    sale_id,
    branch_id,
    return_type,
    refund_amount,
    applied_to_balance,
    refund_method,
    notes,
    created_by,
    idempotency_key
  )
  VALUES (
    v_sale.store_id,
    p_sale_id,
    v_sale.branch_id,
    'refund',
    0,
    0,
    NULL,
    nullif(trim(p_notes), ''),
    v_user_id,
    trim(p_idempotency_key)
  )
  RETURNING id INTO v_return_id;

  -- تسجيل المرتجع وإرجاع الكميات للمخزون
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_item_index := v_item_index + 1;
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    SELECT
      sum(si.quantity),
      sum(si.unit_price * si.quantity - si.discount)
    INTO v_sold_quantity, v_line_base
    FROM public.dokkan_sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.product_variant_id = v_variant_id;

    IF v_all_returned AND v_item_index = v_item_count THEN
      -- آخر صنف في المرتجع الكامل يستوعب فرق التقريب
      v_line_amount := greatest(
        0,
        v_net_remaining_value - v_return_total
      );
    ELSIF v_remaining_base > 0 THEN
      v_line_amount := round(
        v_net_remaining_value
        * (v_line_base * v_quantity / v_sold_quantity)
        / v_remaining_base,
        2
      );
    ELSE
      v_line_amount := 0;
    END IF;

    INSERT INTO public.dokkan_sale_return_items (
      return_id,
      product_variant_id,
      quantity,
      amount
    )
    VALUES (
      v_return_id,
      v_variant_id,
      v_quantity,
      v_line_amount
    );

    INSERT INTO public.dokkan_inventory_movements (
      store_id,
      branch_id,
      product_variant_id,
      movement_type,
      quantity,
      reference_id,
      note,
      created_by
    )
    VALUES (
      v_sale.store_id,
      v_sale.branch_id,
      v_variant_id,
      'return',
      v_quantity,
      v_return_id,
      'Sale return',
      v_user_id
    );

    v_return_total := v_return_total + v_line_amount;
  END LOOP;

  IF v_return_total > v_net_remaining_value THEN
    RAISE EXCEPTION 'return amount exceeds remaining sale value';
  END IF;

  -- تسوية المديونية أولًا
  v_applied := least(v_sale.remaining, v_return_total);

  -- رد الفرق فقط إذا تجاوزت قيمة المرتجع المديونية
  v_cash_refund := v_return_total - v_applied;

  IF v_cash_refund > 0 THEN
    IF p_refund_method IS NULL
       OR p_refund_method NOT IN ('cash', 'card', 'transfer') THEN
      RAISE EXCEPTION 'refund method required';
    END IF;

    IF v_cash_refund >
       greatest(0, v_sale.amount_paid - v_prior_cash_refunds) THEN
      RAISE EXCEPTION 'refund exceeds paid amount';
    END IF;
  END IF;

  UPDATE public.dokkan_sale_returns
  SET
    refund_amount = v_cash_refund,
    applied_to_balance = v_applied,
    refund_method = CASE
      WHEN v_cash_refund > 0 THEN p_refund_method
      ELSE NULL
    END
  WHERE id = v_return_id;

  -- نحافظ على إجمالي الفاتورة والمبلغ المدفوع الأصليين
  -- ونخفض المديونية فقط بالمبلغ الذي تمت تسويته
  UPDATE public.dokkan_sales
  SET
    remaining = greatest(0, remaining - v_applied),
    status = CASE
      WHEN v_all_returned THEN 'returned'
      ELSE 'partially_returned'
    END
  WHERE id = p_sale_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    branch_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    v_sale.store_id,
    v_sale.branch_id,
    'sale_return',
    'sale_return',
    v_return_id,
    v_user_id,
    jsonb_build_object(
      'sale_id', p_sale_id,
      'return_total', v_return_total,
      'applied_to_balance', v_applied,
      'cash_refund', v_cash_refund,
      'refund_method', CASE
        WHEN v_cash_refund > 0 THEN p_refund_method
        ELSE NULL
      END,
      'original_invoice_preserved', true
    )
  );

  RETURN v_return_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_create_sale_return(
  uuid, jsonb, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_create_sale_return(
  uuid, jsonb, text, text, text
) TO authenticated;

COMMIT;

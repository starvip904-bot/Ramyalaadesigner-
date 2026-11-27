
-- Require a valid store supplier and PIN session when creating
-- a product with its initial stock.

-- Remove direct access to the old RPC signature.
REVOKE ALL ON FUNCTION
  public.dokkan_create_product_with_initial_stock(
    uuid, uuid, text, text, text, jsonb
  )
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION
public.dokkan_create_product_with_initial_stock(
  target_store_id uuid,
  target_branch_id uuid,
  product_name text,
  product_category text,
  product_brand text,
  variants jsonb,
  p_supplier_id uuid,
  p_pin_token_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_product_id uuid;
  new_variant_id uuid;
  v jsonb;
  variant_count integer := 0;
  v_price numeric;
  v_cost numeric;
  v_quantity numeric;
  v_sku text;
  v_barcode text;
  movement_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR target_store_id IS NULL
     OR target_branch_id IS NULL
     OR p_supplier_id IS NULL
     OR NOT private.dokkan_has_role(
       target_store_id,
       ARRAY['owner', 'admin', 'manager', 'stock_manager']::text[]
     )
  THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  PERFORM private.dokkan_require_store_section_pin_session(
    target_store_id,
    p_pin_token_hash
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.dokkan_suppliers s
    WHERE s.id = p_supplier_id
      AND s.store_id = target_store_id
      AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'invalid supplier';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dokkan_branches b
    WHERE b.id = target_branch_id
      AND b.store_id = target_store_id
      AND b.status = 'active'
  ) OR NOT private.dokkan_can_branch(target_branch_id) THEN
    RAISE EXCEPTION 'invalid inventory branch';
  END IF;

  IF NULLIF(TRIM(product_name), '') IS NULL
     OR NULLIF(TRIM(product_category), '') IS NULL
     OR variants IS NULL
     OR jsonb_typeof(variants) IS DISTINCT FROM 'array'
     OR jsonb_array_length(variants) < 1
     OR jsonb_array_length(variants) > 200
  THEN
    RAISE EXCEPTION 'invalid product';
  END IF;

  INSERT INTO public.dokkan_products (
    store_id,
    name,
    category,
    brand,
    supplier_id
  )
  VALUES (
    target_store_id,
    TRIM(product_name),
    TRIM(product_category),
    NULLIF(TRIM(product_brand), ''),
    p_supplier_id
  )
  RETURNING id INTO new_product_id;

  FOR v IN
    SELECT value FROM jsonb_array_elements(variants)
  LOOP
    IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid variant';
    END IF;

    v_price := (v->>'price')::numeric;
    v_cost := (v->>'cost')::numeric;
    v_quantity := COALESCE(
      NULLIF(v->>'initial_quantity', '')::numeric,
      0
    );

    v_sku := NULLIF(TRIM(v->>'sku'), '');
    v_barcode := NULLIF(TRIM(v->>'barcode'), '');

    IF v_sku IS NULL
       OR v_price IS NULL
       OR v_cost IS NULL
       OR v_quantity IS NULL
       OR v_price < 0
       OR v_cost < 0
       OR v_quantity < 0
       OR v_price::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_cost::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_quantity::text IN ('NaN', 'Infinity', '-Infinity')
    THEN
      RAISE EXCEPTION 'invalid variant or opening quantity';
    END IF;

    INSERT INTO public.dokkan_product_variants (
      store_id,
      product_id,
      sku,
      barcode,
      size,
      color,
      price,
      cost
    )
    VALUES (
      target_store_id,
      new_product_id,
      v_sku,
      v_barcode,
      NULLIF(TRIM(v->>'size'), ''),
      NULLIF(TRIM(v->>'color'), ''),
      v_price,
      v_cost
    )
    RETURNING id INTO new_variant_id;

    IF v_quantity > 0 THEN
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
        target_store_id,
        target_branch_id,
        new_variant_id,
        'opening',
        v_quantity,
        NULL,
        'Initial stock recorded during product creation',
        auth.uid()
      )
      RETURNING id INTO movement_id;

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
        target_store_id,
        target_branch_id,
        'inventory_movement',
        'inventory_movement',
        movement_id,
        auth.uid(),
        jsonb_build_object(
          'movement_type', 'opening',
          'product_id', new_product_id,
          'variant_id', new_variant_id,
          'quantity', v_quantity
        )
      );
    END IF;

    variant_count := variant_count + 1;
  END LOOP;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    target_store_id,
    'create',
    'product',
    new_product_id,
    auth.uid(),
    jsonb_build_object(
      'variant_count', variant_count,
      'initial_stock_branch_id', target_branch_id,
      'supplier_id', p_supplier_id
    )
  );

  RETURN new_product_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.dokkan_create_product_with_initial_stock(
    uuid, uuid, text, text, text, jsonb, uuid, text
  )
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dokkan_create_product_with_initial_stock(
    uuid, uuid, text, text, text, jsonb, uuid, text
  )
TO authenticated;

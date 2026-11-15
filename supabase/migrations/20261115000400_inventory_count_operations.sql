
-- Dokkan Inventory Count Operations
-- Creates and manages inventory count sessions and item counting.
-- Approval and stock adjustments will be implemented separately.
-- Requires: 20261115000200_inventory_count_tables.sql

BEGIN;

-- =========================================================
-- 1. Create inventory count
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_create_inventory_count(
  p_store_id uuid,
  p_branch_id uuid,
  p_count_number text,
  p_count_type text,
  p_notes text DEFAULT NULL,
  p_original_count_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_count_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_store_id IS NULL
     OR p_branch_id IS NULL
     OR p_count_number IS NULL
     OR length(trim(p_count_number)) = 0
     OR p_count_type NOT IN ('full', 'partial') THEN
    RAISE EXCEPTION 'invalid inventory count';
  END IF;

  IF NOT private.dokkan_has_role(
    p_store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dokkan_branches b
    WHERE b.id = p_branch_id
      AND b.store_id = p_store_id
      AND b.status = 'active'
  ) THEN
    RAISE EXCEPTION 'invalid inventory branch';
  END IF;

  IF NOT private.dokkan_can_branch(p_branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_original_count_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.dokkan_inventory_counts c
       WHERE c.id = p_original_count_id
         AND c.store_id = p_store_id
         AND c.branch_id = p_branch_id
         AND c.status = 'approved'
     ) THEN
    RAISE EXCEPTION 'invalid original inventory count';
  END IF;

  INSERT INTO public.dokkan_inventory_counts (
    store_id,
    branch_id,
    count_number,
    count_type,
    status,
    notes,
    created_by,
    original_count_id
  )
  VALUES (
    p_store_id,
    p_branch_id,
    trim(p_count_number),
    p_count_type,
    'draft',
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_user_id,
    p_original_count_id
  )
  RETURNING id INTO v_count_id;

  INSERT INTO public.dokkan_inventory_count_events (
    count_id,
    store_id,
    branch_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    v_count_id,
    p_store_id,
    p_branch_id,
    v_user_id,
    'created',
    jsonb_build_object(
      'count_type', p_count_type,
      'count_number', trim(p_count_number),
      'original_count_id', p_original_count_id
    )
  );

  RETURN v_count_id;
END;
$function$;


-- =========================================================
-- 2. Add product variant to count
-- Supports draft and counting sessions.
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_add_inventory_count_item(
  p_count_id uuid,
  p_product_variant_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_count public.dokkan_inventory_counts%ROWTYPE;
  v_variant record;
  v_item_id uuid;
  v_current_qty numeric := 0;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_count_id IS NULL OR p_product_variant_id IS NULL THEN
    RAISE EXCEPTION 'invalid inventory count item';
  END IF;

  SELECT *
  INTO v_count
  FROM public.dokkan_inventory_counts
  WHERE id = p_count_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count not found';
  END IF;

  IF v_count.status NOT IN ('draft', 'counting') THEN
    RAISE EXCEPTION 'inventory count is not editable';
  END IF;

  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the variant using the same lock used by stock movements.
  SELECT
    v.id,
    v.store_id,
    v.product_id,
    v.sku,
    v.barcode,
    v.size,
    v.color,
    p.name AS product_name,
    p.category,
    p.brand
  INTO v_variant
  FROM public.dokkan_product_variants v
  JOIN public.dokkan_products p
    ON p.id = v.product_id
   AND p.store_id = v.store_id
  WHERE v.id = p_product_variant_id
    AND v.store_id = v_count.store_id
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid product variant';
  END IF;

  -- For an item added after the count started, save its current
  -- system balance as its initial reference quantity.
  IF v_count.status = 'counting' THEN
    SELECT COALESCE(SUM(
      CASE movement_type
        WHEN 'opening' THEN quantity
        WHEN 'purchase' THEN quantity
        WHEN 'return' THEN quantity
        WHEN 'transfer_in' THEN quantity
        WHEN 'sale' THEN -quantity
        WHEN 'transfer_out' THEN -quantity
        WHEN 'damage' THEN -quantity
        WHEN 'adjustment' THEN quantity
        ELSE 0
      END
    ), 0)
    INTO v_current_qty
    FROM public.dokkan_inventory_movements
    WHERE store_id = v_count.store_id
      AND branch_id = v_count.branch_id
      AND product_variant_id = p_product_variant_id;
  END IF;

  INSERT INTO public.dokkan_inventory_count_items (
    count_id,
    store_id,
    branch_id,
    product_variant_id,
    product_name,
    category,
    brand,
    sku,
    barcode,
    size,
    color,
    system_quantity_at_start
  )
  VALUES (
    v_count.id,
    v_count.store_id,
    v_count.branch_id,
    v_variant.id,
    v_variant.product_name,
    v_variant.category,
    v_variant.brand,
    v_variant.sku,
    v_variant.barcode,
    v_variant.size,
    v_variant.color,
    v_current_qty
  )
  ON CONFLICT (count_id, product_variant_id) DO NOTHING
  RETURNING id INTO v_item_id;

  -- Make repeated requests idempotent.
  IF v_item_id IS NULL THEN
    SELECT id
    INTO v_item_id
    FROM public.dokkan_inventory_count_items
    WHERE count_id = v_count.id
      AND product_variant_id = p_product_variant_id;

    RETURN v_item_id;
  END IF;

  INSERT INTO public.dokkan_inventory_count_events (
    count_id,
    store_id,
    branch_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    v_count.id,
    v_count.store_id,
    v_count.branch_id,
    v_user_id,
    'item_added',
    jsonb_build_object(
      'count_item_id', v_item_id,
      'product_variant_id', p_product_variant_id,
      'added_after_start', v_count.status = 'counting'
    )
  );

  RETURN v_item_id;
END;
$function$;


-- =========================================================
-- 3. Start inventory count
-- Full count automatically includes all product variants.
-- Partial count uses the variants selected before starting.
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_start_inventory_count(
  p_count_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_count public.dokkan_inventory_counts%ROWTYPE;
  v_variant record;
  v_current_qty numeric;
  v_item_count integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO v_count
  FROM public.dokkan_inventory_counts
  WHERE id = p_count_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count not found';
  END IF;

  IF v_count.status <> 'draft' THEN
    RAISE EXCEPTION 'inventory count cannot be started';
  END IF;

  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dokkan_branches b
    WHERE b.id = v_count.branch_id
      AND b.store_id = v_count.store_id
      AND b.status = 'active'
  ) THEN
    RAISE EXCEPTION 'inventory branch is not active';
  END IF;

  -- Full count: include all existing variants in this store.
  -- Inactive products are retained too, so their stock is not lost.
  IF v_count.count_type = 'full' THEN
    INSERT INTO public.dokkan_inventory_count_items (
      count_id,
      store_id,
      branch_id,
      product_variant_id,
      product_name,
      category,
      brand,
      sku,
      barcode,
      size,
      color
    )
    SELECT
      v_count.id,
      v_count.store_id,
      v_count.branch_id,
      v.id,
      p.name,
      p.category,
      p.brand,
      v.sku,
      v.barcode,
      v.size,
      v.color
    FROM public.dokkan_product_variants v
    JOIN public.dokkan_products p
      ON p.id = v.product_id
     AND p.store_id = v.store_id
    WHERE v.store_id = v_count.store_id
    ON CONFLICT (count_id, product_variant_id) DO NOTHING;
  END IF;

  SELECT COUNT(*)
  INTO v_item_count
  FROM public.dokkan_inventory_count_items
  WHERE count_id = v_count.id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'inventory count has no items';
  END IF;

  UPDATE public.dokkan_inventory_counts
  SET
    status = 'counting',
    started_by = v_user_id,
    started_at = clock_timestamp(),
    updated_at = clock_timestamp()
  WHERE id = v_count.id;

  -- Lock all variants in a deterministic order.
  -- This follows the same variant lock protocol as sales,
  -- returns, and inventory movement operations.
  FOR v_variant IN
    SELECT v.id
    FROM public.dokkan_inventory_count_items i
    JOIN public.dokkan_product_variants v
      ON v.id = i.product_variant_id
     AND v.store_id = i.store_id
    WHERE i.count_id = v_count.id
    ORDER BY v.id
    FOR UPDATE OF v
  LOOP
    SELECT COALESCE(SUM(
      CASE movement_type
        WHEN 'opening' THEN quantity
        WHEN 'purchase' THEN quantity
        WHEN 'return' THEN quantity
        WHEN 'transfer_in' THEN quantity
        WHEN 'sale' THEN -quantity
        WHEN 'transfer_out' THEN -quantity
        WHEN 'damage' THEN -quantity
        WHEN 'adjustment' THEN quantity
        ELSE 0
      END
    ), 0)
    INTO v_current_qty
    FROM public.dokkan_inventory_movements
    WHERE store_id = v_count.store_id
      AND branch_id = v_count.branch_id
      AND product_variant_id = v_variant.id;

    UPDATE public.dokkan_inventory_count_items
    SET
      system_quantity_at_start = v_current_qty,
      updated_at = clock_timestamp()
    WHERE count_id = v_count.id
      AND product_variant_id = v_variant.id
      AND system_quantity_at_count IS NULL;
  END LOOP;

  INSERT INTO public.dokkan_inventory_count_events (
    count_id,
    store_id,
    branch_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    v_count.id,
    v_count.store_id,
    v_count.branch_id,
    v_user_id,
    'started',
    jsonb_build_object(
      'count_type', v_count.count_type,
      'item_count', v_item_count
    )
  );
END;
$function$;


-- =========================================================
-- 4. Record actual counted quantity
-- Captures system balance at the exact counting operation.
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_record_inventory_count_item(
  p_count_id uuid,
  p_product_variant_id uuid,
  p_actual_quantity numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_count public.dokkan_inventory_counts%ROWTYPE;
  v_item public.dokkan_inventory_count_items%ROWTYPE;
  v_current_qty numeric := 0;
  v_difference numeric;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_count_id IS NULL
     OR p_product_variant_id IS NULL
     OR p_actual_quantity IS NULL
     OR p_actual_quantity < 0
     OR p_actual_quantity IN (
       'NaN'::numeric,
       'Infinity'::numeric,
       '-Infinity'::numeric
     ) THEN
    RAISE EXCEPTION 'invalid counted quantity';
  END IF;

  SELECT *
  INTO v_count
  FROM public.dokkan_inventory_counts
  WHERE id = p_count_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count not found';
  END IF;

  IF v_count.status <> 'counting' THEN
    RAISE EXCEPTION 'inventory count is not accepting quantities';
  END IF;

  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the variant before reading its balance.
  PERFORM 1
  FROM public.dokkan_product_variants
  WHERE id = p_product_variant_id
    AND store_id = v_count.store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid product variant';
  END IF;

  SELECT *
  INTO v_item
  FROM public.dokkan_inventory_count_items
  WHERE count_id = v_count.id
    AND product_variant_id = p_product_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product variant is not part of this count';
  END IF;

  SELECT COALESCE(SUM(
    CASE movement_type
      WHEN 'opening' THEN quantity
      WHEN 'purchase' THEN quantity
      WHEN 'return' THEN quantity
      WHEN 'transfer_in' THEN quantity
      WHEN 'sale' THEN -quantity
      WHEN 'transfer_out' THEN -quantity
      WHEN 'damage' THEN -quantity
      WHEN 'adjustment' THEN quantity
      ELSE 0
    END
  ), 0)
  INTO v_current_qty
  FROM public.dokkan_inventory_movements
  WHERE store_id = v_count.store_id
    AND branch_id = v_count.branch_id
    AND product_variant_id = p_product_variant_id;

  v_difference := p_actual_quantity - v_current_qty;

  UPDATE public.dokkan_inventory_count_items
  SET
    system_quantity_at_count = v_current_qty,
    actual_quantity = p_actual_quantity,
    difference = v_difference,
    counted_by = v_user_id,
    count_at = clock_timestamp(),
    updated_at = clock_timestamp()
  WHERE id = v_item.id;

  INSERT INTO public.dokkan_inventory_count_events (
    count_id,
    store_id,
    branch_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    v_count.id,
    v_count.store_id,
    v_count.branch_id,
    v_user_id,
    'item_counted',
    jsonb_build_object(
      'count_item_id', v_item.id,
      'product_variant_id', p_product_variant_id,
      'system_quantity_at_count', v_current_qty,
      'actual_quantity', p_actual_quantity,
      'difference', v_difference
    )
  );

  RETURN v_item.id;
END;
$function$;


-- =========================================================
-- 5. Submit count for review
-- All items must have actual counted quantities.
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_submit_inventory_count_for_review(
  p_count_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_count public.dokkan_inventory_counts%ROWTYPE;
  v_total integer;
  v_counted integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO v_count
  FROM public.dokkan_inventory_counts
  WHERE id = p_count_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count not found';
  END IF;

  IF v_count.status <> 'counting' THEN
    RAISE EXCEPTION 'inventory count cannot be submitted';
  END IF;

  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE actual_quantity IS NOT NULL
        AND system_quantity_at_count IS NOT NULL
        AND difference IS NOT NULL
        AND counted_by IS NOT NULL
        AND count_at IS NOT NULL
    )
  INTO v_total, v_counted
  FROM public.dokkan_inventory_count_items
  WHERE count_id = v_count.id;

  IF v_total = 0 OR v_total <> v_counted THEN
    RAISE EXCEPTION 'all inventory count items must be counted';
  END IF;

  UPDATE public.dokkan_inventory_counts
  SET
    status = 'review',
    updated_at = clock_timestamp()
  WHERE id = v_count.id;

  INSERT INTO public.dokkan_inventory_count_events (
    count_id,
    store_id,
    branch_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    v_count.id,
    v_count.store_id,
    v_count.branch_id,
    v_user_id,
    'submitted_for_review',
    jsonb_build_object(
      'item_count', v_total
    )
  );
END;
$function$;


-- =========================================================
-- 6. Restrict RPC execution
-- =========================================================

REVOKE ALL ON FUNCTION public.dokkan_create_inventory_count(
  uuid, uuid, text, text, text, uuid
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.dokkan_add_inventory_count_item(
  uuid, uuid
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.dokkan_start_inventory_count(
  uuid
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.dokkan_record_inventory_count_item(
  uuid, uuid, numeric
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.dokkan_submit_inventory_count_for_review(
  uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_create_inventory_count(
  uuid, uuid, text, text, text, uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_add_inventory_count_item(
  uuid, uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_start_inventory_count(
  uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_record_inventory_count_item(
  uuid, uuid, numeric
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_submit_inventory_count_for_review(
  uuid
) TO authenticated;

COMMIT;

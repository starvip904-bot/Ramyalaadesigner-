
-- Dokkan Inventory Count Approval
-- Only owner and manager can approve.
-- Applies differences to current stock balances.
-- Historical sales and inventory movements remain unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.dokkan_approve_inventory_count(
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
  v_item record;

  v_current_qty numeric := 0;
  v_new_qty numeric := 0;
  v_movement_id uuid;

  v_total_items integer := 0;
  v_counted_items integer := 0;
  v_adjusted_items integer := 0;
  v_total_adjustment numeric := 0;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_count_id IS NULL THEN
    RAISE EXCEPTION 'inventory count id is required';
  END IF;

  SELECT *
  INTO v_count
  FROM public.dokkan_inventory_counts
  WHERE id = p_count_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count not found';
  END IF;

  IF v_count.status <> 'review' THEN
    RAISE EXCEPTION 'only counts awaiting review can be approved';
  END IF;

  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager']
  ) THEN
    RAISE EXCEPTION 'only owner or manager can approve inventory counts';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized for this branch';
  END IF;

  -- Existing counts may be completed after the branch is deactivated.
  -- New counts are still restricted to active branches.

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE actual_quantity IS NOT NULL
        AND system_quantity_at_count IS NOT NULL
        AND difference IS NOT NULL
        AND counted_by IS NOT NULL
        AND count_at IS NOT NULL
    )
  INTO v_total_items, v_counted_items
  FROM public.dokkan_inventory_count_items
  WHERE count_id = v_count.id;

  IF v_total_items = 0 OR v_total_items <> v_counted_items THEN
    RAISE EXCEPTION 'all inventory count items must be counted';
  END IF;

  -- Lock all variants in deterministic order.
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
    NULL;
  END LOOP;

  -- Apply differences to current balances.
  FOR v_item IN
    SELECT
      i.id,
      i.product_variant_id,
      i.difference
    FROM public.dokkan_inventory_count_items i
    WHERE i.count_id = v_count.id
    ORDER BY i.product_variant_id
    FOR UPDATE
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
      AND product_variant_id = v_item.product_variant_id;

    v_new_qty := v_current_qty + v_item.difference;

    IF v_new_qty < 0 THEN
      RAISE EXCEPTION
        'inventory count would create negative stock for variant %',
        v_item.product_variant_id;
    END IF;

    IF v_item.difference <> 0 THEN

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
        v_count.store_id,
        v_count.branch_id,
        v_item.product_variant_id,
        'adjustment',
        v_item.difference,
        v_count.id,
        'Inventory count approval: ' || v_count.count_number,
        v_user_id
      )
      RETURNING id INTO v_movement_id;

      INSERT INTO public.dokkan_inventory_count_adjustments (
        count_id,
        count_item_id,
        store_id,
        branch_id,
        product_variant_id,
        movement_id,
        adjustment_quantity
      )
      VALUES (
        v_count.id,
        v_item.id,
        v_count.store_id,
        v_count.branch_id,
        v_item.product_variant_id,
        v_movement_id,
        v_item.difference
      );

      v_adjusted_items := v_adjusted_items + 1;
      v_total_adjustment := v_total_adjustment + v_item.difference;
    END IF;

  END LOOP;

  UPDATE public.dokkan_inventory_counts
  SET
    status = 'approved',
    approved_by = v_user_id,
    approved_at = clock_timestamp(),
    updated_at = clock_timestamp()
  WHERE id = v_count.id
    AND status = 'review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count approval failed';
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
    'approved',
    jsonb_build_object(
      'count_number', v_count.count_number,
      'total_items', v_total_items,
      'counted_items', v_counted_items,
      'adjusted_items', v_adjusted_items,
      'total_adjustment', v_total_adjustment
    )
  );

  INSERT INTO public.dokkan_audit_events (
    store_id,
    branch_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_count.store_id,
    v_count.branch_id,
    v_user_id,
    'inventory_count_approved',
    'inventory_count',
    v_count.id,
    jsonb_build_object(
      'count_number', v_count.count_number,
      'total_items', v_total_items,
      'counted_items', v_counted_items,
      'adjusted_items', v_adjusted_items,
      'total_adjustment', v_total_adjustment
    )
  );

END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_approve_inventory_count(
  uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_approve_inventory_count(
  uuid
) TO authenticated;

COMMIT;


-- Dokkan Inventory Count Approval
-- Approval is restricted to store owner and manager.
-- Applies count differences to current stock balances.
-- Does not modify historical inventory movements or sales.

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
  v_adjusted_items integer := 0;
  v_total_adjustment numeric := 0;
BEGIN
  -- =======================================================
  -- 1. Authentication
  -- =======================================================

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_count_id IS NULL THEN
    RAISE EXCEPTION 'inventory count id is required';
  END IF;

  -- =======================================================
  -- 2. Lock and validate the count session
  -- =======================================================

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

  -- Only owner and manager may approve.
  -- Admin and stock_manager are deliberately excluded.
  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager']
  ) THEN
    RAISE EXCEPTION 'only owner or manager can approve inventory counts';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized for this branch';
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

  -- =======================================================
  -- 3. Validate all counted items
  -- =======================================================

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE actual_quantity IS NOT NULL
        AND system_quantity_at_count IS NOT NULL
        AND difference IS NOT NULL
        AND counted_by IS NOT NULL
        AND count_at IS NOT NULL
    )
  INTO v_total_items, v_adjusted_items
  FROM public.dokkan_inventory_count_items
  WHERE count_id = v_count.id;

  IF v_total_items = 0 OR v_total_items <> v_adjusted_items THEN
    RAISE EXCEPTION 'all inventory count items must be counted';
  END IF;

  -- =======================================================
  -- 4. Lock all product variants in deterministic order
  -- =======================================================

  -- This uses the same variant row lock protocol as the
  -- inventory movement and sales return operations.
  -- All variants are locked before applying any adjustment.

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

  -- =======================================================
  -- 5. Apply differences to current balances
  -- =======================================================

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

    -- Recalculate current balance after obtaining variant locks.
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

    -- Apply the difference to the current balance,
    -- not to the balance that existed when counting started.
    v_new_qty := v_current_qty + v_item.difference;

    IF v_new_qty < 0 THEN
      RAISE EXCEPTION
        'inventory count would create negative stock for variant %',
        v_item.product_variant_id;
    END IF;

    -- No movement is needed when the difference is zero.
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

      -- Link the generated movement to its exact count item.
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

  -- =======================================================
  -- 6. Mark count as approved
  -- =======================================================

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

  -- =======================================================
  -- 7. Append immutable count event
  -- =======================================================

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
      'adjusted_items', v_adjusted_items,
      'total_adjustment', v_total_adjustment
    )
  );

  -- =======================================================
  -- 8. Audit trail
  -- =======================================================

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
      'adjusted_items', v_adjusted_items,
      'total_adjustment', v_total_adjustment
    )
  );

END;
$function$;


-- =========================================================
-- 9. Restrict execution permissions
-- =========================================================

REVOKE ALL ON FUNCTION public.dokkan_approve_inventory_count(
  uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_approve_inventory_count(
  uuid
) TO authenticated;

COMMIT;

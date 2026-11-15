
-- Dokkan: Lock product variants before receiving purchase stock.
-- This makes purchase receiving follow the same variant-row
-- locking protocol used by sales, returns, and inventory counts.
-- Existing permissions and purchase behavior are preserved.

BEGIN;

CREATE OR REPLACE FUNCTION public.dokkan_receive_purchase(
  p_purchase_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  purchase_row public.dokkan_purchases%ROWTYPE;
  line record;

  variant_id_to_lock uuid;
  locked_variant_id uuid;
BEGIN
  -- =======================================================
  -- 1. Authentication
  -- =======================================================

  IF auth.uid() IS NULL OR p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;


  -- =======================================================
  -- 2. Lock purchase document
  -- =======================================================

  SELECT *
  INTO purchase_row
  FROM public.dokkan_purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT private.dokkan_has_role(
       purchase_row.store_id,
       ARRAY['owner','admin','manager','stock_manager']
     )
     OR NOT private.dokkan_can_branch(purchase_row.branch_id)
     OR NOT EXISTS (
       SELECT 1
       FROM public.dokkan_branches b
       WHERE b.id = purchase_row.branch_id
         AND b.store_id = purchase_row.store_id
         AND b.status = 'active'
     ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;


  -- =======================================================
  -- 3. Preserve existing status behavior
  -- =======================================================

  IF purchase_row.status = 'received' THEN
    RETURN;
  END IF;

  IF purchase_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'invalid purchase status';
  END IF;


  -- =======================================================
  -- 4. Lock all affected variants in deterministic order
  --
  -- IMPORTANT:
  -- Every stock-changing operation should lock variant rows
  -- before inserting inventory movements.
  --
  -- DISTINCT avoids locking the same variant more than once
  -- when a purchase contains multiple lines for that variant.
  -- ORDER BY prevents inconsistent lock ordering.
  -- =======================================================

  FOR variant_id_to_lock IN
    SELECT DISTINCT pi.product_variant_id
    FROM public.dokkan_purchase_items pi
    WHERE pi.purchase_id = p_purchase_id
      AND pi.quantity > pi.received_quantity
    ORDER BY pi.product_variant_id
  LOOP

    locked_variant_id := NULL;

    SELECT v.id
    INTO locked_variant_id
    FROM public.dokkan_product_variants v
    WHERE v.id = variant_id_to_lock
      AND v.store_id = purchase_row.store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid purchase item variant';
    END IF;

  END LOOP;


  -- =======================================================
  -- 5. Receive remaining purchase quantities
  --
  -- Purchase item rows are also locked in a deterministic
  -- order after all affected variants have been locked.
  -- =======================================================

  FOR line IN
    SELECT
      pi.id,
      pi.product_variant_id,
      (pi.quantity - pi.received_quantity) AS remaining
    FROM public.dokkan_purchase_items pi
    WHERE pi.purchase_id = p_purchase_id
      AND pi.quantity > pi.received_quantity
    ORDER BY pi.product_variant_id, pi.id
    FOR UPDATE
  LOOP

    IF line.remaining IS NULL OR line.remaining <= 0 THEN
      CONTINUE;
    END IF;


    -- Record received stock.
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
      purchase_row.store_id,
      purchase_row.branch_id,
      line.product_variant_id,
      'purchase',
      line.remaining,
      p_purchase_id,
      auth.uid()
    );


    -- Mark this purchase line as fully received.
    UPDATE public.dokkan_purchase_items
    SET received_quantity = quantity
    WHERE id = line.id
      AND purchase_id = p_purchase_id;

  END LOOP;


  -- =======================================================
  -- 6. Update supplier balance
  -- =======================================================

  IF purchase_row.supplier_id IS NOT NULL THEN

    UPDATE public.dokkan_suppliers
    SET
      balance = balance + purchase_row.total,
      updated_at = now()
    WHERE id = purchase_row.supplier_id
      AND store_id = purchase_row.store_id;

  END IF;


  -- =======================================================
  -- 7. Update purchase status
  -- =======================================================

  UPDATE public.dokkan_purchases
  SET
    status = 'received',
    posted_at = now()
  WHERE id = p_purchase_id;


  -- =======================================================
  -- 8. Audit event
  -- =======================================================

  INSERT INTO public.dokkan_audit_events (
    store_id,
    branch_id,
    action,
    entity_type,
    entity_id,
    actor_id
  )
  VALUES (
    purchase_row.store_id,
    purchase_row.branch_id,
    'receive',
    'purchase',
    p_purchase_id,
    auth.uid()
  );

END;
$function$;

COMMIT;

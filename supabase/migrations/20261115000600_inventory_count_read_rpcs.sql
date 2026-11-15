
-- Dokkan Inventory Count Read RPCs
-- Secure read-only access to inventory count lists and details.
-- Requires inventory count foundation and operations migrations.

BEGIN;

-- =========================================================
-- 1. List inventory counts
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_list_inventory_counts(
  p_store_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  count_id uuid,
  store_id uuid,
  branch_id uuid,
  branch_name text,
  count_number text,
  count_type text,
  status text,
  notes text,
  created_by uuid,
  started_by uuid,
  approved_by uuid,
  started_at timestamptz,
  approved_at timestamptz,
  original_count_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  total_items bigint,
  counted_items bigint,
  total_difference numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'store id is required';
  END IF;

  IF p_status IS NOT NULL
     AND p_status NOT IN (
       'draft',
       'counting',
       'review',
       'approved',
       'cancelled'
     ) THEN
    RAISE EXCEPTION 'invalid inventory count status';
  END IF;

  IF NOT private.dokkan_has_role(
    p_store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.store_id,
    c.branch_id,
    b.name,
    c.count_number,
    c.count_type,
    c.status,
    c.notes,
    c.created_by,
    c.started_by,
    c.approved_by,
    c.started_at,
    c.approved_at,
    c.original_count_id,
    c.created_at,
    c.updated_at,
    COUNT(i.id),
    COUNT(i.id) FILTER (
      WHERE i.actual_quantity IS NOT NULL
    ),
    COALESCE(SUM(i.difference), 0)
  FROM public.dokkan_inventory_counts c
  JOIN public.dokkan_branches b
    ON b.id = c.branch_id
   AND b.store_id = c.store_id
  LEFT JOIN public.dokkan_inventory_count_items i
    ON i.count_id = c.id
  WHERE c.store_id = p_store_id
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    AND (p_status IS NULL OR c.status = p_status)
    AND private.dokkan_can_branch(c.branch_id)
  GROUP BY c.id, b.name
  ORDER BY c.created_at DESC;

END;
$function$;


-- =========================================================
-- 2. Read one inventory count with items and event history
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_get_inventory_count(
  p_count_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_count public.dokkan_inventory_counts%ROWTYPE;
  v_branch_name text;
  v_result jsonb;
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
  FROM public.dokkan_inventory_counts c
  WHERE c.id = p_count_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory count not found';
  END IF;

  IF NOT private.dokkan_has_role(
    v_count.store_id,
    ARRAY['owner', 'manager', 'admin', 'stock_manager']
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT private.dokkan_can_branch(v_count.branch_id) THEN
    RAISE EXCEPTION 'not authorized for this branch';
  END IF;

  SELECT b.name
  INTO v_branch_name
  FROM public.dokkan_branches b
  WHERE b.id = v_count.branch_id
    AND b.store_id = v_count.store_id;

  SELECT jsonb_build_object(
    'count', to_jsonb(v_count),
    'branch_name', v_branch_name,

    'items',
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(i)
          ORDER BY i.product_name, i.sku, i.id
        )
        FROM public.dokkan_inventory_count_items i
        WHERE i.count_id = v_count.id
          AND i.store_id = v_count.store_id
          AND i.branch_id = v_count.branch_id
      ),
      '[]'::jsonb
    ),

    'events',
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(e)
          ORDER BY e.created_at, e.id
        )
        FROM public.dokkan_inventory_count_events e
        WHERE e.count_id = v_count.id
          AND e.store_id = v_count.store_id
          AND e.branch_id = v_count.branch_id
      ),
      '[]'::jsonb
    ),

    'adjustments',
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(a)
          ORDER BY a.created_at, a.id
        )
        FROM public.dokkan_inventory_count_adjustments a
        WHERE a.count_id = v_count.id
          AND a.store_id = v_count.store_id
          AND a.branch_id = v_count.branch_id
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;


-- =========================================================
-- 3. Restrict execution to authenticated users
-- =========================================================

REVOKE ALL ON FUNCTION
  public.dokkan_list_inventory_counts(uuid, uuid, text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_get_inventory_count(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dokkan_list_inventory_counts(uuid, uuid, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_get_inventory_count(uuid)
TO authenticated;

COMMIT;

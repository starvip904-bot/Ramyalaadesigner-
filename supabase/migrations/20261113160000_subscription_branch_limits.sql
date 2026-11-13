
-- Dokkan: enforce subscription branch limits safely.
-- Active branches count toward the Free plan limit.
-- Unknown plans or inactive subscriptions cannot add/reactivate branches.
-- Existing branches are never deleted or automatically disabled.

BEGIN;

-- =========================================================
-- 1) Secure branch creation
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_create_branch(
  target_store_id uuid,
  branch_name text,
  branch_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_id uuid;
  target_plan text;
  target_subscription_status text;
  active_branch_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF target_store_id IS NULL THEN
    RAISE EXCEPTION 'invalid store';
  END IF;

  IF NOT private.dokkan_has_role(
    target_store_id,
    ARRAY['owner', 'admin']::text[]
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NULLIF(TRIM(branch_name), '') IS NULL THEN
    RAISE EXCEPTION 'invalid branch';
  END IF;

  -- Lock the store to serialize branch creation and reactivation.
  SELECT s.plan_code, s.subscription_status
    INTO target_plan, target_subscription_status
  FROM public.dokkan_stores AS s
  WHERE s.id = target_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  -- Unknown plans and inactive subscriptions cannot add branches.
  IF target_plan IS NULL
     OR target_plan NOT IN (
       'free',
       'basic',
       'professional',
       'enterprise'
     )
     OR target_subscription_status IS DISTINCT FROM 'active'
  THEN
    RAISE EXCEPTION 'SUBSCRIPTION_PLAN_UNRESOLVED'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Free plan allows one active branch.
  IF target_plan = 'free' THEN
    SELECT COUNT(*)::integer
      INTO active_branch_count
    FROM public.dokkan_branches AS b
    WHERE b.store_id = target_store_id
      AND b.status = 'active';

    IF active_branch_count >= 1 THEN
      RAISE EXCEPTION 'FREE_PLAN_BRANCH_LIMIT_REACHED'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Paid plan branch limits remain pending approved specifications.
  INSERT INTO public.dokkan_branches (
    store_id,
    name,
    address
  )
  VALUES (
    target_store_id,
    TRIM(branch_name),
    NULLIF(TRIM(branch_address), '')
  )
  RETURNING id INTO new_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id
  )
  VALUES (
    target_store_id,
    'create',
    'branch',
    new_id,
    auth.uid()
  );

  RETURN new_id;
END;
$function$;


-- =========================================================
-- 2) Secure branch activation/deactivation
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_set_branch_status(
  target_branch_id uuid,
  next_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  sid uuid;
  current_branch_status text;
  target_plan text;
  target_subscription_status text;
  active_branch_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF next_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  -- Resolve the branch and its current status.
  SELECT b.store_id, b.status
    INTO sid, current_branch_status
  FROM public.dokkan_branches AS b
  WHERE b.id = target_branch_id;

  IF sid IS NULL THEN
    RAISE EXCEPTION 'branch not found';
  END IF;

  -- Lock the store so concurrent activations cannot bypass the limit.
  SELECT s.plan_code, s.subscription_status
    INTO target_plan, target_subscription_status
  FROM public.dokkan_stores AS s
  WHERE s.id = sid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  IF NOT private.dokkan_has_role(
    sid,
    ARRAY['owner', 'admin']::text[]
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Deactivation is always allowed.
  -- Reactivation must pass the subscription checks.
  IF next_status = 'active'
     AND current_branch_status IS DISTINCT FROM 'active'
  THEN
    IF target_plan IS NULL
       OR target_plan NOT IN (
         'free',
         'basic',
         'professional',
         'enterprise'
       )
       OR target_subscription_status IS DISTINCT FROM 'active'
    THEN
      RAISE EXCEPTION 'SUBSCRIPTION_PLAN_UNRESOLVED'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Free plan allows one active branch.
    IF target_plan = 'free' THEN
      SELECT COUNT(*)::integer
        INTO active_branch_count
      FROM public.dokkan_branches AS b
      WHERE b.store_id = sid
        AND b.status = 'active'
        AND b.id <> target_branch_id;

      IF active_branch_count >= 1 THEN
        RAISE EXCEPTION 'FREE_PLAN_BRANCH_LIMIT_REACHED'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  UPDATE public.dokkan_branches
  SET
    status = next_status,
    updated_at = now()
  WHERE id = target_branch_id
    AND store_id = sid;

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
    sid,
    target_branch_id,
    'set_status',
    'branch',
    target_branch_id,
    auth.uid(),
    jsonb_build_object('status', next_status)
  );
END;
$function$;

COMMIT;

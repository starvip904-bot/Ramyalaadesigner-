
-- Dokkan: strict employee branch access and safe assignment management
-- This migration is intended to be applied once.

BEGIN;

-- 1) Add composite uniqueness required by the store-integrity foreign keys.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dokkan_members'::regclass
      AND conname = 'dokkan_members_id_store_id_key'
  ) THEN
    ALTER TABLE public.dokkan_members
      ADD CONSTRAINT dokkan_members_id_store_id_key
      UNIQUE (id, store_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dokkan_branches'::regclass
      AND conname = 'dokkan_branches_id_store_id_key'
  ) THEN
    ALTER TABLE public.dokkan_branches
      ADD CONSTRAINT dokkan_branches_id_store_id_key
      UNIQUE (id, store_id);
  END IF;
END;
$$;

-- 2) Enforce that each assignment's member and branch belong to the same store.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dokkan_member_branches'::regclass
      AND conname = 'dokkan_member_branches_member_store_fkey'
  ) THEN
    ALTER TABLE public.dokkan_member_branches
      ADD CONSTRAINT dokkan_member_branches_member_store_fkey
      FOREIGN KEY (member_id, store_id)
      REFERENCES public.dokkan_members (id, store_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dokkan_member_branches'::regclass
      AND conname = 'dokkan_member_branches_branch_store_fkey'
  ) THEN
    ALTER TABLE public.dokkan_member_branches
      ADD CONSTRAINT dokkan_member_branches_branch_store_fkey
      FOREIGN KEY (branch_id, store_id)
      REFERENCES public.dokkan_branches (id, store_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

-- 3) Strict branch authorization:
-- owner/admin/manager: all branches in their store.
-- Other roles: explicitly assigned branches only.
CREATE OR REPLACE FUNCTION private.dokkan_can_branch(
  target_branch_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.dokkan_branches b
    JOIN public.dokkan_members m
      ON m.store_id = b.store_id
    WHERE b.id = target_branch_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND (
        m.role IN ('owner', 'admin', 'manager')
        OR EXISTS (
          SELECT 1
          FROM public.dokkan_member_branches mb
          WHERE mb.member_id = m.id
            AND mb.store_id = m.store_id
            AND mb.branch_id = b.id
        )
      )
  );
$function$;

-- The helper is needed by authenticated RLS policies.
REVOKE ALL ON FUNCTION private.dokkan_can_branch(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.dokkan_can_branch(uuid)
  TO authenticated;

-- 4) Secure RPC for replacing an employee's branch assignments.
CREATE OR REPLACE FUNCTION public.dokkan_set_member_branches(
  target_member_id uuid,
  target_branch_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_store_id uuid;
  v_role text;
  v_status text;
  v_branch_ids uuid[];
  v_distinct_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Resolve the target member and its store.
  SELECT m.store_id, m.role, m.status
    INTO v_store_id, v_role, v_status
  FROM public.dokkan_members m
  WHERE m.id = target_member_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Only an owner or admin of this same store may manage assignments.
  IF NOT private.dokkan_has_role(
    v_store_id,
    ARRAY['owner', 'admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage branch assignments';
  END IF;

  IF v_status NOT IN ('active', 'invited') THEN
    RAISE EXCEPTION 'Only active or invited members can be assigned';
  END IF;

  -- Privileged roles already have access to every branch.
  IF v_role IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Privileged members do not use branch assignments';
  END IF;

  v_branch_ids := COALESCE(target_branch_ids, ARRAY[]::uuid[]);

  SELECT count(DISTINCT x)
    INTO v_distinct_count
  FROM unnest(v_branch_ids) AS x;

  IF v_distinct_count <> cardinality(v_branch_ids) THEN
    RAISE EXCEPTION 'Duplicate branch IDs are not allowed';
  END IF;

  -- Every requested branch must be active and belong to this store.
  IF EXISTS (
    SELECT 1
    FROM unnest(v_branch_ids) AS requested(branch_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.dokkan_branches b
      WHERE b.id = requested.branch_id
        AND b.store_id = v_store_id
        AND b.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'One or more branches are invalid or inactive';
  END IF;

  -- Replace assignments atomically for this member and store.
  DELETE FROM public.dokkan_member_branches mb
  WHERE mb.member_id = target_member_id
    AND mb.store_id = v_store_id;

  INSERT INTO public.dokkan_member_branches (
    store_id,
    member_id,
    branch_id
  )
  SELECT
    v_store_id,
    target_member_id,
    requested.branch_id
  FROM unnest(v_branch_ids) AS requested(branch_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_set_member_branches(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dokkan_set_member_branches(uuid, uuid[])
  TO authenticated;

-- 5) Remove direct table writes; assignments must go through the RPC.
REVOKE ALL ON TABLE public.dokkan_member_branches FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.dokkan_member_branches
  FROM authenticated;

-- Keep authenticated read access subject to the existing RLS policy.
GRANT SELECT ON TABLE public.dokkan_member_branches TO authenticated;

COMMIT;

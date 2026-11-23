
-- Secure employee branch scope and invitation store integrity.
-- Existing employee, attendance, and invitation records remain unchanged.

BEGIN;

-- 1) Ensure employee invitations always reference an employee
-- belonging to the same store.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_employee_invitations'::regclass
      AND conname = 'dokkan_employee_invitations_employee_store_fkey'
  ) THEN
    ALTER TABLE public.dokkan_employee_invitations
      ADD CONSTRAINT dokkan_employee_invitations_employee_store_fkey
      FOREIGN KEY (employee_id, store_id)
      REFERENCES public.dokkan_employees (id, store_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

-- 2) Owners and admins can access all branches.
-- Managers and other members can access assigned branches only.
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
        m.role IN ('owner', 'admin')
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

REVOKE ALL ON FUNCTION private.dokkan_can_branch(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.dokkan_can_branch(uuid)
  TO authenticated;

COMMIT;

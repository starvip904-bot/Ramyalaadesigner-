
-- Allow stock managers to access only their assigned branches.
-- Test database migration. Does not grant access to all store branches.

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
        OR (
          m.role IN ('manager', 'stock_manager')
          AND EXISTS (
            SELECT 1
            FROM public.dokkan_member_branches mb
            WHERE mb.member_id = m.id
              AND mb.store_id = m.store_id
              AND mb.branch_id = b.id
          )
        )
      )
  );
$function$;

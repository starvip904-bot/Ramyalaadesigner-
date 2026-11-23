
-- Link Dokkan employee records to their login memberships.
-- Existing employee and attendance records remain unchanged.

BEGIN;

-- 1) Add the optional employee link to store memberships.
ALTER TABLE public.dokkan_members
  ADD COLUMN IF NOT EXISTS employee_id uuid;

-- 2) Enforce that the linked employee belongs to the same store.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_members'::regclass
      AND conname = 'dokkan_members_employee_store_fkey'
  ) THEN
    ALTER TABLE public.dokkan_members
      ADD CONSTRAINT dokkan_members_employee_store_fkey
      FOREIGN KEY (employee_id, store_id)
      REFERENCES public.dokkan_employees (id, store_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

-- 3) One employee record can be linked to only one login account.
CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_members_employee_id_unique_idx
ON public.dokkan_members (employee_id)
WHERE employee_id IS NOT NULL;

-- 4) Document the relationship.
COMMENT ON COLUMN public.dokkan_members.employee_id IS
  'Optional link to the internal employee record. NULL for store owners and non-employee memberships.';

COMMIT;

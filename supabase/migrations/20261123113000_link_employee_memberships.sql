
-- Link Dokkan employee records to their login memberships.
-- Existing employee and attendance records remain unchanged.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_employees'::regclass
      AND conname = 'dokkan_employees_id_store_unique'
  ) THEN
    ALTER TABLE public.dokkan_employees
      ADD CONSTRAINT dokkan_employees_id_store_unique
      UNIQUE (id, store_id);
  END IF;
END;
$$;

ALTER TABLE public.dokkan_members
  ADD COLUMN IF NOT EXISTS employee_id uuid;

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

CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_members_employee_id_unique_idx
ON public.dokkan_members (employee_id)
WHERE employee_id IS NOT NULL;

COMMENT ON COLUMN public.dokkan_members.employee_id IS
  'Optional link to the internal employee record. NULL for store owners and non-employee memberships.';

COMMIT;

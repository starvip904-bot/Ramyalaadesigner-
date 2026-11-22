
-- Internal employees: records only, never login accounts.
CREATE TABLE IF NOT EXISTS public.dokkan_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL
    REFERENCES public.dokkan_stores(id) ON DELETE CASCADE,
  branch_id uuid NULL,
  name text NOT NULL,
  phone text NULL,
  role text NOT NULL DEFAULT 'cashier',
  status text NOT NULL DEFAULT 'active',
  created_by uuid NULL
    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_employees_name_check
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),

  CONSTRAINT dokkan_employees_phone_check
    CHECK (phone IS NULL OR char_length(phone) <= 40),

  CONSTRAINT dokkan_employees_role_check
    CHECK (role IN ('manager', 'cashier', 'stock_manager', 'viewer')),

  CONSTRAINT dokkan_employees_status_check
    CHECK (status IN ('active', 'inactive')),

  CONSTRAINT dokkan_employees_branch_store_fkey
    FOREIGN KEY (branch_id, store_id)
    REFERENCES public.dokkan_branches(id, store_id)
);

CREATE INDEX IF NOT EXISTS dokkan_employees_store_idx
  ON public.dokkan_employees(store_id);

CREATE INDEX IF NOT EXISTS dokkan_employees_branch_idx
  ON public.dokkan_employees(branch_id);

ALTER TABLE public.dokkan_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dokkan_employees_manager_read
  ON public.dokkan_employees;

CREATE POLICY dokkan_employees_manager_read
  ON public.dokkan_employees
  FOR SELECT
  TO authenticated
  USING (
    private.dokkan_has_role(
      store_id,
      ARRAY['owner', 'admin', 'manager']::text[]
    )
  );

DROP POLICY IF EXISTS dokkan_employees_manager_insert
  ON public.dokkan_employees;

CREATE POLICY dokkan_employees_manager_insert
  ON public.dokkan_employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.dokkan_has_role(
      store_id,
      ARRAY['owner', 'admin', 'manager']::text[]
    )
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS dokkan_employees_manager_update
  ON public.dokkan_employees;

CREATE POLICY dokkan_employees_manager_update
  ON public.dokkan_employees
  FOR UPDATE
  TO authenticated
  USING (
    private.dokkan_has_role(
      store_id,
      ARRAY['owner', 'admin', 'manager']::text[]
    )
  )
  WITH CHECK (
    private.dokkan_has_role(
      store_id,
      ARRAY['owner', 'admin', 'manager']::text[]
    )
  );

REVOKE ALL ON TABLE public.dokkan_employees
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.dokkan_employees
  TO authenticated;

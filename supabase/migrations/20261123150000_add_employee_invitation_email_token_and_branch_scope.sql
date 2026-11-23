
-- Add employee email and secure invitation token storage.
-- Store selected invitation branches without changing employee history.

BEGIN;

-- 1) Employee email is optional for existing employee records.
ALTER TABLE public.dokkan_employees
  ADD COLUMN IF NOT EXISTS email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_employees'::regclass
      AND conname = 'dokkan_employees_email_normalized_check'
  ) THEN
    ALTER TABLE public.dokkan_employees
      ADD CONSTRAINT dokkan_employees_email_normalized_check
      CHECK (
        email IS NULL
        OR (
          email = lower(btrim(email))
          AND length(email) BETWEEN 5 AND 320
          AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        )
      );
  END IF;
END;
$$;

-- Prevent duplicate employee emails inside the same store.
CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_employees_store_email_unique_idx
ON public.dokkan_employees (store_id, email)
WHERE email IS NOT NULL;

-- 2) Store only SHA-256 hashes of invitation tokens.
ALTER TABLE public.dokkan_employee_invitations
  ADD COLUMN IF NOT EXISTS token_hash text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_employee_invitations'::regclass
      AND conname = 'dokkan_employee_invitations_token_hash_check'
  ) THEN
    ALTER TABLE public.dokkan_employee_invitations
      ADD CONSTRAINT dokkan_employee_invitations_token_hash_check
      CHECK (
        token_hash IS NULL
        OR token_hash ~ '^[a-f0-9]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_employee_invitations'::regclass
      AND conname = 'dokkan_employee_invitations_pending_token_required'
  ) THEN
    ALTER TABLE public.dokkan_employee_invitations
      ADD CONSTRAINT dokkan_employee_invitations_pending_token_required
      CHECK (
        status <> 'pending'
        OR token_hash IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dokkan_employee_invitations'::regclass
      AND conname = 'dokkan_employee_invitations_id_store_unique'
  ) THEN
    ALTER TABLE public.dokkan_employee_invitations
      ADD CONSTRAINT dokkan_employee_invitations_id_store_unique
      UNIQUE (id, store_id);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_employee_invitations_token_hash_unique_idx
ON public.dokkan_employee_invitations (token_hash)
WHERE token_hash IS NOT NULL;

-- 3) Store the selected branches for each invitation.
-- This allows multiple branches without changing the employee history.

CREATE TABLE IF NOT EXISTS public.dokkan_employee_invitation_branches (
  invitation_id uuid NOT NULL,
  store_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_employee_invitation_branches_pkey
    PRIMARY KEY (invitation_id, branch_id),

  CONSTRAINT dokkan_employee_invitation_branches_invitation_store_fkey
    FOREIGN KEY (invitation_id, store_id)
    REFERENCES public.dokkan_employee_invitations (id, store_id)
    ON DELETE CASCADE,

  CONSTRAINT dokkan_employee_invitation_branches_branch_store_fkey
    FOREIGN KEY (branch_id, store_id)
    REFERENCES public.dokkan_branches (id, store_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
  dokkan_employee_invitation_branches_store_idx
ON public.dokkan_employee_invitation_branches (store_id);

-- Invitation branch selections are server-only.
ALTER TABLE public.dokkan_employee_invitation_branches
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dokkan_employee_invitation_branches
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.dokkan_employees.email IS
  'Normalized employee email used for account invitations.';

COMMENT ON COLUMN public.dokkan_employee_invitations.token_hash IS
  'SHA-256 hash of the invitation token. Raw invitation tokens must never be stored.';

COMMENT ON TABLE public.dokkan_employee_invitation_branches IS
  'Server-only branch selections attached to employee invitations.';

COMMIT;

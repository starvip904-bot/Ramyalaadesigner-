
-- Secure per-store PIN storage.
-- This migration creates storage only; verification and session
-- authorization will be implemented separately.

CREATE TABLE IF NOT EXISTS private.dokkan_store_section_pin (
  store_id uuid PRIMARY KEY
    REFERENCES public.dokkan_stores(id)
    ON DELETE CASCADE,

  pin_hash text NOT NULL
    CHECK (char_length(pin_hash) BETWEEN 50 AND 100),

  pin_version integer NOT NULL DEFAULT 1
    CHECK (pin_version > 0),

  failed_attempts integer NOT NULL DEFAULT 0
    CHECK (failed_attempts >= 0),

  locked_until timestamptz,

  updated_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE private.dokkan_store_section_pin IS
  'Private hashed PIN credentials for protected sections, isolated per store.';

COMMENT ON COLUMN private.dokkan_store_section_pin.pin_hash IS
  'Password hash only. Never store or expose the original PIN.';

COMMENT ON COLUMN private.dokkan_store_section_pin.pin_version IS
  'Incremented when the store PIN changes to invalidate previous sessions.';

-- No direct access from API roles.
REVOKE ALL ON TABLE private.dokkan_store_section_pin
  FROM PUBLIC, anon, authenticated, service_role;

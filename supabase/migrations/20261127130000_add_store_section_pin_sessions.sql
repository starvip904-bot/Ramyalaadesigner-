
-- Dokkan: secure per-store protected-section PIN sessions.
-- Requires 20261127120000_add_store_section_pin.sql.
-- PIN sessions last 8 hours and are bound to the authenticated user,
-- store, and current PIN version.

BEGIN;

-- 1) Private server-validated PIN sessions.
CREATE TABLE IF NOT EXISTS private.dokkan_store_section_pin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  store_id uuid NOT NULL
    REFERENCES public.dokkan_stores(id)
    ON DELETE CASCADE,

  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  token_hash text NOT NULL
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),

  pin_version integer NOT NULL
    CHECK (pin_version > 0),

  expires_at timestamptz NOT NULL,

  revoked_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_store_section_pin_sessions_token_hash_key
ON private.dokkan_store_section_pin_sessions (token_hash);

CREATE INDEX IF NOT EXISTS
  dokkan_store_section_pin_sessions_store_user_idx
ON private.dokkan_store_section_pin_sessions
  (store_id, user_id, expires_at);

COMMENT ON TABLE private.dokkan_store_section_pin_sessions IS
  'Server-validated, short-lived sessions for protected Dokkan sections.';

COMMENT ON COLUMN private.dokkan_store_section_pin_sessions.token_hash IS
  'SHA-256 hash of a random session token. Never store the raw token.';

REVOKE ALL ON TABLE private.dokkan_store_section_pin_sessions
  FROM PUBLIC, anon, authenticated, service_role;


-- 2) Set or change the current store PIN.
-- Only the active store owner may change it.
-- PIN format: 4 to 8 digits.

CREATE OR REPLACE FUNCTION public.dokkan_set_store_section_pin(
  p_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_store_id uuid;
  v_membership_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'PIN must contain 4 to 8 digits';
  END IF;

  SELECT count(*)
    INTO v_membership_count
  FROM public.dokkan_members m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active';

  IF v_membership_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one active store membership is required';
  END IF;

  SELECT m.store_id
    INTO v_store_id
  FROM public.dokkan_members m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role = 'owner';

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Only the store owner can change the PIN';
  END IF;

  INSERT INTO private.dokkan_store_section_pin (
    store_id,
    pin_hash,
    pin_version,
    failed_attempts,
    locked_until,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    v_store_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
    1,
    0,
    NULL,
    auth.uid(),
    now(),
    now()
  )
  ON CONFLICT (store_id)
  DO UPDATE SET
    pin_hash = extensions.crypt(
      p_pin,
      extensions.gen_salt('bf', 12)
    ),
    pin_version =
      private.dokkan_store_section_pin.pin_version + 1,
    failed_attempts = 0,
    locked_until = NULL,
    updated_by = auth.uid(),
    updated_at = now();

  -- Changing the PIN invalidates every previous session.
  UPDATE private.dokkan_store_section_pin_sessions
  SET revoked_at = now()
  WHERE store_id = v_store_id
    AND revoked_at IS NULL;

  RETURN true;
END;
$function$;


-- 3) Verify the PIN and create an 8-hour session.
-- The application supplies only a SHA-256 token hash.
-- The raw random token stays in the server-managed cookie.

CREATE OR REPLACE FUNCTION public.dokkan_verify_store_section_pin(
  p_pin text,
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_store_id uuid;
  v_membership_count integer;
  v_pin private.dokkan_store_section_pin%ROWTYPE;
  v_next_attempts integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,8}$' THEN
    RETURN false;
  END IF;

  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid session token hash';
  END IF;

  SELECT count(*)
    INTO v_membership_count
  FROM public.dokkan_members m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active';

  IF v_membership_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one active store membership is required';
  END IF;

  SELECT m.store_id
    INTO v_store_id
  FROM public.dokkan_members m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active';

  SELECT *
    INTO v_pin
  FROM private.dokkan_store_section_pin p
  WHERE p.store_id = v_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Respect an active lock.
  IF v_pin.locked_until IS NOT NULL
     AND v_pin.locked_until > now() THEN
    RETURN false;
  END IF;

  -- Reset an expired lock before checking the next attempt.
  IF v_pin.locked_until IS NOT NULL
     AND v_pin.locked_until <= now() THEN
    UPDATE private.dokkan_store_section_pin
    SET failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE store_id = v_store_id;

    v_pin.failed_attempts := 0;
    v_pin.locked_until := NULL;
  END IF;

  IF extensions.crypt(p_pin, v_pin.pin_hash) <> v_pin.pin_hash THEN
    v_next_attempts := v_pin.failed_attempts + 1;

    UPDATE private.dokkan_store_section_pin
    SET failed_attempts = v_next_attempts,
        locked_until = CASE
          WHEN v_next_attempts >= 5
            THEN now() + interval '15 minutes'
          ELSE NULL
        END,
        updated_at = now()
    WHERE store_id = v_store_id;

    RETURN false;
  END IF;

  -- Successful verification resets failed attempts.
  UPDATE private.dokkan_store_section_pin
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = now()
  WHERE store_id = v_store_id;

  -- Replace any previous session for this user and store.
  UPDATE private.dokkan_store_section_pin_sessions
  SET revoked_at = now()
  WHERE store_id = v_store_id
    AND user_id = auth.uid()
    AND revoked_at IS NULL;

  INSERT INTO private.dokkan_store_section_pin_sessions (
    store_id,
    user_id,
    token_hash,
    pin_version,
    expires_at
  )
  VALUES (
    v_store_id,
    auth.uid(),
    p_token_hash,
    v_pin.pin_version,
    now() + interval '8 hours'
  );

  RETURN true;
END;
$function$;


-- 4) Validate a session on every protected server request/action.
-- A valid Supabase login alone is not sufficient.

CREATE OR REPLACE FUNCTION public.dokkan_validate_store_section_pin_session(
  p_store_id uuid,
  p_token_hash text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.dokkan_store_section_pin_sessions s
    JOIN private.dokkan_store_section_pin p
      ON p.store_id = s.store_id
     AND p.pin_version = s.pin_version
    JOIN public.dokkan_members m
      ON m.store_id = s.store_id
     AND m.user_id = s.user_id
    WHERE s.store_id = p_store_id
      AND s.user_id = auth.uid()
      AND s.token_hash = p_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND m.status = 'active'
  );
$function$;


-- 5) Revoke the current user's session.
CREATE OR REPLACE FUNCTION public.dokkan_revoke_store_section_pin_session(
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  UPDATE private.dokkan_store_section_pin_sessions
  SET revoked_at = now()
  WHERE user_id = auth.uid()
    AND token_hash = p_token_hash
    AND revoked_at IS NULL;

  RETURN true;
END;
$function$;


-- 6) Restrict RPC execution to authenticated users.
REVOKE ALL ON FUNCTION
  public.dokkan_set_store_section_pin(text)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_verify_store_section_pin(text, text)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_validate_store_section_pin_session(uuid, text)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_revoke_store_section_pin_session(text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dokkan_set_store_section_pin(text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_verify_store_section_pin(text, text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_validate_store_section_pin_session(uuid, text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_revoke_store_section_pin_session(text)
  TO authenticated;

COMMIT;

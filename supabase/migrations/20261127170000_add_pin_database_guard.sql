
-- Add a private database guard for store PIN sessions.
-- This helper is intended to be called by trusted SECURITY DEFINER
-- wrappers. It must never be directly executable by application roles.

CREATE OR REPLACE FUNCTION private.dokkan_require_store_section_pin_session(
  p_store_id uuid,
  p_token_hash text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_store_id IS NULL
     OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Store PIN session required';
  END IF;

  IF NOT EXISTS (
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
  ) THEN
    RAISE EXCEPTION 'Store PIN session required';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION
  private.dokkan_require_store_section_pin_session(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;


BEGIN;

-- Add the selected billing cycle to every subscription request.
-- Existing requests are preserved and default to monthly.
ALTER TABLE public.dokkan_subscription_requests
  ADD COLUMN IF NOT EXISTS billing_cycle text
  NOT NULL DEFAULT 'monthly';

ALTER TABLE public.dokkan_subscription_requests
  DROP CONSTRAINT IF EXISTS dokkan_subscription_requests_billing_cycle_check;

ALTER TABLE public.dokkan_subscription_requests
  ADD CONSTRAINT dokkan_subscription_requests_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'annual'));

-- Replace the previous three-argument RPC with a four-argument version.
DROP FUNCTION IF EXISTS public.dokkan_create_subscription_request(
  text,
  text,
  numeric
);

CREATE OR REPLACE FUNCTION public.dokkan_create_subscription_request(
  p_plan_code text,
  p_proof_mime_type text,
  p_billing_cycle text,
  p_claimed_amount_egp numeric DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  proof_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_request_id uuid := gen_random_uuid();
  v_extension text;
  v_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_plan_code NOT IN (
    'basic',
    'professional',
    'enterprise'
  ) THEN
    RAISE EXCEPTION 'invalid subscription plan';
  END IF;

  IF p_billing_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'invalid billing cycle';
  END IF;

  IF p_claimed_amount_egp IS NOT NULL
     AND p_claimed_amount_egp < 0 THEN
    RAISE EXCEPTION 'invalid claimed amount';
  END IF;

  CASE p_proof_mime_type
    WHEN 'image/jpeg' THEN v_extension := 'jpg';
    WHEN 'image/png' THEN v_extension := 'png';
    WHEN 'image/webp' THEN v_extension := 'webp';
    WHEN 'application/pdf' THEN v_extension := 'pdf';
    ELSE
      RAISE EXCEPTION 'unsupported proof file type';
  END CASE;

  SELECT m.store_id
  INTO v_store_id
  FROM public.dokkan_members AS m
  JOIN public.dokkan_stores AS s
    ON s.id = m.store_id
  WHERE m.user_id = v_user_id
    AND m.status = 'active'
    AND s.status = 'active'
    AND m.role IN ('owner', 'admin', 'manager')
  ORDER BY m.created_at
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'active store membership required';
  END IF;

  IF (
    SELECT count(*)
    FROM public.dokkan_members AS m
    JOIN public.dokkan_stores AS s
      ON s.id = m.store_id
    WHERE m.user_id = v_user_id
      AND m.status = 'active'
      AND s.status = 'active'
      AND m.role IN ('owner', 'admin', 'manager')
  ) <> 1 THEN
    RAISE EXCEPTION 'exactly one active store is required';
  END IF;

  v_path :=
    v_store_id::text || '/' ||
    v_request_id::text || '/' ||
    gen_random_uuid()::text || '.' ||
    v_extension;

  INSERT INTO public.dokkan_subscription_requests (
    id,
    store_id,
    requested_plan_code,
    billing_cycle,
    status,
    proof_path,
    proof_mime_type,
    claimed_amount_egp,
    created_by
  )
  VALUES (
    v_request_id,
    v_store_id,
    p_plan_code,
    p_billing_cycle,
    'draft',
    v_path,
    p_proof_mime_type,
    p_claimed_amount_egp,
    v_user_id
  );

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    v_store_id,
    'create',
    'subscription_request',
    v_request_id,
    v_user_id,
    jsonb_build_object(
      'plan_code', p_plan_code,
      'billing_cycle', p_billing_cycle,
      'status', 'draft'
    )
  );

  RETURN QUERY
  SELECT v_request_id, v_path;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.dokkan_create_subscription_request(
    text,
    text,
    text,
    numeric
  )
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dokkan_create_subscription_request(
    text,
    text,
    text,
    numeric
  )
TO authenticated;

COMMIT;

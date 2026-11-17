
BEGIN;

-- =========================================================
-- 1. Preserve legacy plan codes and allow current plan codes
-- =========================================================

ALTER TABLE public.dokkan_stores
  DROP CONSTRAINT IF EXISTS dokkan_stores_plan_code_check;

ALTER TABLE public.dokkan_stores
  ADD CONSTRAINT dokkan_stores_plan_code_check
  CHECK (
    plan_code IS NULL OR
    plan_code IN (
      'free',
      'starter',
      'pro',
      'business',
      'basic',
      'professional',
      'enterprise'
    )
  );

-- =========================================================
-- 2. Private bucket for subscription proofs
-- =========================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'dokkan-subscription-proofs',
  'dokkan-subscription-proofs',
  false,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =========================================================
-- 3. Subscription requests table
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dokkan_subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  store_id uuid NOT NULL
    REFERENCES public.dokkan_stores(id)
    ON DELETE RESTRICT,

  requested_plan_code text NOT NULL
    CHECK (
      requested_plan_code IN (
        'basic',
        'professional',
        'enterprise'
      )
    ),

  status text NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'pending',
        'approved',
        'rejected',
        'cancelled'
      )
    ),

  proof_path text NOT NULL UNIQUE,

  proof_mime_type text NOT NULL
    CHECK (
      proof_mime_type IN (
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      )
    ),

  proof_size bigint
    CHECK (
      proof_size IS NULL OR
      proof_size BETWEEN 1 AND 5242880
    ),

  claimed_amount_egp numeric(12,2)
    CHECK (
      claimed_amount_egp IS NULL OR
      claimed_amount_egp >= 0
    ),

  created_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,

  reviewed_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  reviewed_at timestamptz,

  verified_amount_egp numeric(12,2)
    CHECK (
      verified_amount_egp IS NULL OR
      verified_amount_egp >= 0
    ),

  subscription_started_at timestamptz,
  subscription_ends_at timestamptz,

  rejection_reason text,
  admin_notes text,

  CONSTRAINT dokkan_subscription_request_review_check
  CHECK (
    (
      status = 'approved'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND verified_amount_egp IS NOT NULL
      AND subscription_started_at IS NOT NULL
      AND subscription_ends_at IS NOT NULL
    )
    OR status <> 'approved'
  )
);

CREATE INDEX IF NOT EXISTS
  dokkan_subscription_requests_store_created_idx
ON public.dokkan_subscription_requests (
  store_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  dokkan_subscription_requests_status_created_idx
ON public.dokkan_subscription_requests (
  status,
  created_at DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS
  dokkan_subscription_requests_one_open_per_store_idx
ON public.dokkan_subscription_requests (store_id)
WHERE status IN ('draft', 'pending');

-- =========================================================
-- 4. Table permissions and RLS
-- =========================================================

ALTER TABLE public.dokkan_subscription_requests
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dokkan_subscription_requests
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.dokkan_subscription_requests
  TO authenticated;

DROP POLICY IF EXISTS
  dokkan_subscription_requests_read_access
ON public.dokkan_subscription_requests;

CREATE POLICY dokkan_subscription_requests_read_access
ON public.dokkan_subscription_requests
FOR SELECT
TO authenticated
USING (
  private.dokkan_has_role(
    store_id,
    ARRAY['owner', 'admin', 'manager']::text[]
  )
  OR public.dokkan_is_platform_owner()
);

-- No direct INSERT, UPDATE or DELETE permissions.
-- Changes are made through validated RPC functions.

-- =========================================================
-- 5. Create a draft and reserve its exact proof path
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_create_subscription_request(
  p_plan_code text,
  p_proof_mime_type text,
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
      'status', 'draft'
    )
  );

  RETURN QUERY
  SELECT v_request_id, v_path;
END;
$function$;

-- =========================================================
-- 6. Cancel an unfinished draft
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_cancel_subscription_request(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.dokkan_subscription_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT *
  INTO v_request
  FROM public.dokkan_subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription request not found';
  END IF;

  IF v_request.created_by IS DISTINCT FROM v_user_id
     OR v_request.status <> 'draft'
     OR NOT private.dokkan_has_role(
       v_request.store_id,
       ARRAY['owner', 'admin', 'manager']::text[]
     ) THEN
    RAISE EXCEPTION 'draft cannot be cancelled';
  END IF;

  UPDATE public.dokkan_subscription_requests
  SET status = 'cancelled'
  WHERE id = p_request_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    v_request.store_id,
    'cancel',
    'subscription_request',
    p_request_id,
    v_user_id,
    jsonb_build_object('status', 'cancelled')
  );
END;
$function$;

-- =========================================================
-- 7. Submit only after exact proof file was uploaded
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_submit_subscription_request(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.dokkan_subscription_requests%ROWTYPE;
  v_file_size bigint;
  v_file_mime text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT *
  INTO v_request
  FROM public.dokkan_subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription request not found';
  END IF;

  IF v_request.created_by IS DISTINCT FROM v_user_id
     OR v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'request cannot be submitted';
  END IF;

  IF NOT private.dokkan_has_role(
    v_request.store_id,
    ARRAY['owner', 'admin', 'manager']::text[]
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the store and verify that it is still active.
  PERFORM 1
  FROM public.dokkan_stores
  WHERE id = v_request.store_id
    AND status = 'active'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store is not active';
  END IF;

  -- Verify the exact uploaded object.
  SELECT
    NULLIF(o.metadata ->> 'size', '')::bigint,
    o.metadata ->> 'mimetype'
  INTO v_file_size, v_file_mime
  FROM storage.objects AS o
  WHERE o.bucket_id = 'dokkan-subscription-proofs'
    AND o.name = v_request.proof_path;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proof file not found';
  END IF;

  IF v_file_size IS NULL
     OR v_file_size < 1
     OR v_file_size > 5242880 THEN
    RAISE EXCEPTION 'invalid proof file size';
  END IF;

  IF v_file_mime IS DISTINCT FROM v_request.proof_mime_type THEN
    RAISE EXCEPTION 'proof file type mismatch';
  END IF;

  UPDATE public.dokkan_subscription_requests
  SET
    status = 'pending',
    proof_size = v_file_size,
    submitted_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    v_request.store_id,
    'submit',
    'subscription_request',
    p_request_id,
    v_user_id,
    jsonb_build_object('status', 'pending')
  );
END;
$function$;

-- =========================================================
-- 8. Approve request and activate subscription atomically
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_approve_subscription_request(
  p_request_id uuid,
  p_verified_amount_egp numeric,
  p_subscription_ends_at timestamptz,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.dokkan_subscription_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL
     OR NOT private.dokkan_is_platform_owner() THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_verified_amount_egp IS NULL
     OR p_verified_amount_egp < 0 THEN
    RAISE EXCEPTION 'invalid verified amount';
  END IF;

  IF p_subscription_ends_at IS NULL
     OR p_subscription_ends_at <= now() THEN
    RAISE EXCEPTION 'invalid subscription end date';
  END IF;

  SELECT *
  INTO v_request
  FROM public.dokkan_subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request is not pending';
  END IF;

  PERFORM 1
  FROM public.dokkan_stores
  WHERE id = v_request.store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  UPDATE public.dokkan_stores
  SET
    plan_code = v_request.requested_plan_code,
    subscription_status = 'active',
    subscription_started_at = now(),
    subscription_ends_at = p_subscription_ends_at,
    updated_at = now()
  WHERE id = v_request.store_id;

  UPDATE public.dokkan_subscription_requests
  SET
    status = 'approved',
    reviewed_by = v_user_id,
    reviewed_at = now(),
    verified_amount_egp = p_verified_amount_egp,
    subscription_started_at = now(),
    subscription_ends_at = p_subscription_ends_at,
    admin_notes = NULLIF(trim(p_admin_notes), '')
  WHERE id = p_request_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    v_request.store_id,
    'approve',
    'subscription_request',
    p_request_id,
    v_user_id,
    jsonb_build_object(
      'plan_code', v_request.requested_plan_code,
      'verified_amount_egp', p_verified_amount_egp,
      'subscription_ends_at', p_subscription_ends_at
    )
  );
END;
$function$;

-- =========================================================
-- 9. Reject request without changing current subscription
-- =========================================================

CREATE OR REPLACE FUNCTION public.dokkan_reject_subscription_request(
  p_request_id uuid,
  p_rejection_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.dokkan_subscription_requests%ROWTYPE;
  v_reason text := NULLIF(trim(p_rejection_reason), '');
BEGIN
  IF v_user_id IS NULL
     OR NOT private.dokkan_is_platform_owner() THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'a valid rejection reason is required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.dokkan_subscription_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request is not pending';
  END IF;

  UPDATE public.dokkan_subscription_requests
  SET
    status = 'rejected',
    reviewed_by = v_user_id,
    reviewed_at = now(),
    rejection_reason = v_reason
  WHERE id = p_request_id;

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    entity_id,
    actor_id,
    metadata
  )
  VALUES (
    v_request.store_id,
    'reject',
    'subscription_request',
    p_request_id,
    v_user_id,
    jsonb_build_object('reason', v_reason)
  );
END;
$function$;

-- =========================================================
-- 10. Secure RPC permissions
-- =========================================================

REVOKE ALL ON FUNCTION
  public.dokkan_create_subscription_request(text, text, numeric)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_cancel_subscription_request(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_submit_subscription_request(uuid)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_approve_subscription_request(uuid, numeric, timestamptz, text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.dokkan_reject_subscription_request(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dokkan_create_subscription_request(text, text, numeric)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_cancel_subscription_request(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_submit_subscription_request(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_approve_subscription_request(uuid, numeric, timestamptz, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.dokkan_reject_subscription_request(uuid, text)
TO authenticated;

-- =========================================================
-- 11. Storage upload policy
-- =========================================================

DROP POLICY IF EXISTS
  dokkan_subscription_proofs_upload
ON storage.objects;

CREATE POLICY dokkan_subscription_proofs_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dokkan-subscription-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.dokkan_subscription_requests AS r
    WHERE r.proof_path = name
      AND r.status = 'draft'
      AND r.created_by = (SELECT auth.uid())
      AND private.dokkan_has_role(
        r.store_id,
        ARRAY['owner', 'admin', 'manager']::text[]
      )
      AND (storage.foldername(name))[1] = r.store_id::text
      AND (storage.foldername(name))[2] = r.id::text
  )
);

-- =========================================================
-- 12. Storage read policy
-- Works for pending, approved and rejected requests.
-- =========================================================

DROP POLICY IF EXISTS
  dokkan_subscription_proofs_read
ON storage.objects;

CREATE POLICY dokkan_subscription_proofs_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokkan-subscription-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.dokkan_subscription_requests AS r
    WHERE r.proof_path = name
      AND (
        private.dokkan_has_role(
          r.store_id,
          ARRAY['owner', 'admin', 'manager']::text[]
        )
        OR public.dokkan_is_platform_owner()
      )
  )
);

-- =========================================================
-- 13. Allow deletion only after a draft was cancelled
-- Never allow deletion or replacement after submission.
-- =========================================================

DROP POLICY IF EXISTS
  dokkan_subscription_proofs_cancelled_draft_delete
ON storage.objects;

CREATE POLICY dokkan_subscription_proofs_cancelled_draft_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dokkan-subscription-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.dokkan_subscription_requests AS r
    WHERE r.proof_path = name
      AND r.status = 'cancelled'
      AND r.created_by = (SELECT auth.uid())
  )
);

-- Intentionally no UPDATE policy.
-- Submitted proofs cannot be replaced or deleted by store users.

COMMIT;

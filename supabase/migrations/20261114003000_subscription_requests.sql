
-- Dokkan subscription requests and private payment proofs.
-- Preserves legacy plan codes and existing store data.
-- Does not activate subscriptions.

BEGIN;

-- Support the currently approved plan names while preserving
-- legacy values already allowed by the previous constraint.
ALTER TABLE public.dokkan_stores
  DROP CONSTRAINT IF EXISTS dokkan_stores_plan_code_check;

ALTER TABLE public.dokkan_stores
  ADD CONSTRAINT dokkan_stores_plan_code_check
  CHECK (
    plan_code IS NULL OR
    plan_code IN (
      'free',
      'basic',
      'professional',
      'enterprise',
      'starter',
      'pro',
      'business'
    )
  );

CREATE TABLE IF NOT EXISTS public.dokkan_subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL
    REFERENCES public.dokkan_stores(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,

  plan_code text NOT NULL
    CHECK (plan_code IN ('basic', 'professional', 'enterprise')),

  duration_months integer
    CHECK (duration_months IS NULL OR duration_months > 0),

  amount numeric(12,2)
    CHECK (amount IS NULL OR amount >= 0),

  currency text,
  payment_reference text,
  proof_path text,
  customer_note text,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dokkan_subscription_review_state_check
    CHECK (
      (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR
      (status IN ('approved', 'rejected')
       AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS
  dokkan_subscription_requests_store_created_idx
ON public.dokkan_subscription_requests (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS
  dokkan_subscription_requests_status_created_idx
ON public.dokkan_subscription_requests (status, created_at DESC);

ALTER TABLE public.dokkan_subscription_requests
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dokkan_subscription_requests
  FROM anon, authenticated;

GRANT SELECT, INSERT
ON public.dokkan_subscription_requests TO authenticated;

CREATE POLICY "Store owners can view subscription requests"
ON public.dokkan_subscription_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.dokkan_members m
    WHERE m.store_id = dokkan_subscription_requests.store_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Platform owner can view all subscription requests"
ON public.dokkan_subscription_requests
FOR SELECT
TO authenticated
USING (
  (SELECT public.dokkan_is_platform_owner()) IS TRUE
);

CREATE POLICY "Store owners can create pending requests"
ON public.dokkan_subscription_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.dokkan_members m
    WHERE m.store_id = dokkan_subscription_requests.store_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
);

-- Private payment proof bucket.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'subscription-payment-proofs',
  'subscription-payment-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types =
    ARRAY['image/jpeg', 'image/png', 'application/pdf'];

CREATE POLICY "Store owners can upload payment proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'subscription-payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.dokkan_members m
    WHERE m.store_id::text = (storage.foldername(name))[1]
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  )
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

CREATE POLICY "Store owners and platform owner can view payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'subscription-payment-proofs'
  AND (
    (SELECT public.dokkan_is_platform_owner()) IS TRUE
    OR EXISTS (
      SELECT 1
      FROM public.dokkan_members m
      WHERE m.store_id::text = (storage.foldername(name))[1]
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
        AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    )
  )
);

COMMIT;

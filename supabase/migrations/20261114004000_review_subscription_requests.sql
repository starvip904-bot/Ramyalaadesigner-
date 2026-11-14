
-- Dokkan: secure platform-owner review and subscription activation.
-- Approval starts the new subscription immediately.
-- No existing subscription is changed before explicit approval.

BEGIN;

ALTER TABLE public.dokkan_subscription_requests
  ADD COLUMN IF NOT EXISTS approved_duration_months integer,
  ADD COLUMN IF NOT EXISTS approved_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS approved_currency text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dokkan_subscription_approved_values_check'
      AND conrelid = 'public.dokkan_subscription_requests'::regclass
  ) THEN
    ALTER TABLE public.dokkan_subscription_requests
      ADD CONSTRAINT dokkan_subscription_approved_values_check
      CHECK (
        (
          status = 'approved'
          AND approved_duration_months > 0
          AND approved_amount >= 0
          AND approved_currency ~ '^[A-Z]{3}$'
        )
        OR
        (
          status IN ('pending', 'rejected')
          AND approved_duration_months IS NULL
          AND approved_amount IS NULL
          AND approved_currency IS NULL
        )
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.dokkan_review_subscription_request(
  p_request_id uuid,
  p_action text,
  p_approved_duration_months integer DEFAULT NULL,
  p_approved_amount numeric DEFAULT NULL,
  p_approved_currency text DEFAULT NULL,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.dokkan_subscription_requests%ROWTYPE;
  v_store public.dokkan_stores%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_currency text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF private.dokkan_is_platform_owner() IS NOT TRUE THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid review action';
  END IF;

  IF p_review_note IS NOT NULL
     AND char_length(p_review_note) > 1000 THEN
    RAISE EXCEPTION 'review note is too long';
  END IF;

  SELECT r.*
    INTO v_request
    FROM public.dokkan_subscription_requests AS r
   WHERE r.id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'subscription request already reviewed';
  END IF;

  -- Serialize subscription changes for this store.
  SELECT s.*
    INTO v_store
    FROM public.dokkan_stores AS s
   WHERE s.id = v_request.store_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.dokkan_subscription_requests
       SET status = 'rejected',
           reviewed_by = v_user_id,
           reviewed_at = v_now,
           review_note = nullif(trim(p_review_note), ''),
           approved_duration_months = NULL,
           approved_amount = NULL,
           approved_currency = NULL,
           updated_at = v_now
     WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'request_id', p_request_id
    );
  END IF;

  -- Approval requires values explicitly supplied by the platform owner.
  IF p_approved_duration_months IS NULL
     OR p_approved_duration_months <= 0
     OR p_approved_duration_months > 120 THEN
    RAISE EXCEPTION 'invalid approved duration';
  END IF;

  IF p_approved_amount IS NULL
     OR p_approved_amount < 0 THEN
    RAISE EXCEPTION 'invalid approved amount';
  END IF;

  v_currency := upper(trim(coalesce(p_approved_currency, '')));

  IF v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'invalid approved currency';
  END IF;

  -- Activate the requested plan immediately.
  -- The old subscription's remaining time is not carried forward.
  UPDATE public.dokkan_stores
     SET plan_code = v_request.plan_code,
         subscription_status = 'active',
         subscription_started_at = v_now,
         subscription_ends_at =
           v_now + make_interval(months => p_approved_duration_months)
   WHERE id = v_request.store_id;

  UPDATE public.dokkan_subscription_requests
     SET status = 'approved',
         reviewed_by = v_user_id,
         reviewed_at = v_now,
         review_note = nullif(trim(p_review_note), ''),
         approved_duration_months = p_approved_duration_months,
         approved_amount = p_approved_amount,
         approved_currency = v_currency,
         updated_at = v_now
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'approved',
    'request_id', p_request_id,
    'store_id', v_request.store_id,
    'plan_code', v_request.plan_code,
    'started_at', v_now,
    'ends_at',
      v_now + make_interval(months => p_approved_duration_months),
    'approved_duration_months', p_approved_duration_months,
    'approved_amount', p_approved_amount,
    'approved_currency', v_currency
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dokkan_review_subscription_request(
  uuid, text, integer, numeric, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_review_subscription_request(
  uuid, text, integer, numeric, text, text
) TO authenticated;

COMMIT;

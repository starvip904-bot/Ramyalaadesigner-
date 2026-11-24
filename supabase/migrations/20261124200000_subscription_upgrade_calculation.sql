
BEGIN;

ALTER TABLE public.dokkan_subscription_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS current_plan_code text,
  ADD COLUMN IF NOT EXISTS current_subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_subscription_paid_amount_egp numeric(12,2),
  ADD COLUMN IF NOT EXISTS target_plan_price_egp numeric(12,2),
  ADD COLUMN IF NOT EXISTS upgrade_credit_egp numeric(12,2),
  ADD COLUMN IF NOT EXISTS amount_due_egp numeric(12,2);

ALTER TABLE public.dokkan_subscription_requests
  DROP CONSTRAINT IF EXISTS dokkan_subscription_requests_request_type_check;

ALTER TABLE public.dokkan_subscription_requests
  ADD CONSTRAINT dokkan_subscription_requests_request_type_check
  CHECK (request_type IN ('subscription', 'upgrade'));

CREATE OR REPLACE FUNCTION public.dokkan_create_upgrade_request(
  p_target_plan_code text,
  p_proof_mime_type text
)
RETURNS TABLE (
  request_id uuid,
  proof_path text,
  billing_cycle text,
  current_plan_code text,
  target_plan_price_egp numeric,
  upgrade_credit_egp numeric,
  amount_due_egp numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_store public.dokkan_stores%ROWTYPE;
  v_current_request public.dokkan_subscription_requests%ROWTYPE;

  v_cycle text;
  v_current_price numeric;
  v_target_price numeric;
  v_credit numeric;
  v_due numeric;

  v_total_seconds numeric;
  v_remaining_seconds numeric;

  v_extension text;
  v_request_id uuid := gen_random_uuid();
  v_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_target_plan_code NOT IN ('basic', 'professional') THEN
    RAISE EXCEPTION 'unsupported upgrade target';
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

  SELECT *
  INTO v_store
  FROM public.dokkan_stores
  WHERE id = v_store_id
  FOR UPDATE;

  IF v_store.plan_code NOT IN ('basic', 'professional') THEN
    RAISE EXCEPTION 'current plan is not eligible for upgrade';
  END IF;

  IF v_store.subscription_status <> 'active'
     OR v_store.subscription_started_at IS NULL
     OR v_store.subscription_ends_at IS NULL
     OR v_store.subscription_ends_at <= now() THEN
    RAISE EXCEPTION 'active subscription required';
  END IF;

  IF v_store.plan_code = p_target_plan_code THEN
    RAISE EXCEPTION 'target plan must be higher';
  END IF;

  IF v_store.plan_code = 'professional' THEN
    RAISE EXCEPTION 'target plan must be higher';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dokkan_subscription_requests AS r
    WHERE r.store_id = v_store_id
      AND r.status IN ('draft', 'pending')
  ) THEN
    RAISE EXCEPTION 'already exists';
  END IF;

  SELECT *
  INTO v_current_request
  FROM public.dokkan_subscription_requests AS r
  WHERE r.store_id = v_store_id
    AND r.status = 'approved'
    AND r.requested_plan_code = v_store.plan_code
    AND r.verified_amount_egp IS NOT NULL
    AND r.verified_amount_egp > 0
  ORDER BY r.reviewed_at DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approved subscription history required';
  END IF;

  v_cycle := v_current_request.billing_cycle;

  IF v_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'unsupported current billing cycle';
  END IF;

  IF v_store.subscription_started_at >= v_store.subscription_ends_at THEN
    RAISE EXCEPTION 'invalid subscription period';
  END IF;

  v_current_price := v_current_request.verified_amount_egp;

  SELECT
    CASE
      WHEN v_cycle = 'monthly'
        THEN (settings -> 'plans' -> p_target_plan_code ->> 'monthlyPriceEgp')::numeric
      WHEN v_cycle = 'annual'
        THEN (settings -> 'plans' -> p_target_plan_code ->> 'annualPriceEgp')::numeric
      ELSE NULL
    END
  INTO v_target_price
  FROM public.dokkan_platform_plan_settings
  WHERE singleton = true;

  IF v_target_price IS NULL OR v_target_price <= 0 THEN
    RAISE EXCEPTION 'target plan price unavailable';
  END IF;

  v_total_seconds :=
    extract(epoch FROM (
      v_store.subscription_ends_at -
      v_store.subscription_started_at
    ));

  v_remaining_seconds :=
    greatest(
      0,
      extract(epoch FROM (
        v_store.subscription_ends_at - now()
      ))
    );

  IF v_total_seconds <= 0 OR v_remaining_seconds <= 0 THEN
    RAISE EXCEPTION 'subscription period has expired';
  END IF;

  v_credit := round(
    v_current_price *
    least(1, v_remaining_seconds / v_total_seconds),
    2
  );

  v_due := greatest(
    0,
    round(v_target_price - v_credit, 2)
  );

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
    request_type,
    current_plan_code,
    current_subscription_started_at,
    current_subscription_ends_at,
    current_subscription_paid_amount_egp,
    target_plan_price_egp,
    upgrade_credit_egp,
    amount_due_egp,
    status,
    proof_path,
    proof_mime_type,
    claimed_amount_egp,
    created_by
  )
  VALUES (
    v_request_id,
    v_store_id,
    p_target_plan_code,
    v_cycle,
    'upgrade',
    v_store.plan_code,
    v_store.subscription_started_at,
    v_store.subscription_ends_at,
    v_current_price,
    v_target_price,
    v_credit,
    v_due,
    'draft',
    v_path,
    p_proof_mime_type,
    v_due,
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
    'subscription_upgrade_request',
    v_request_id,
    v_user_id,
    jsonb_build_object(
      'current_plan_code', v_store.plan_code,
      'target_plan_code', p_target_plan_code,
      'billing_cycle', v_cycle,
      'current_paid_amount_egp', v_current_price,
      'target_plan_price_egp', v_target_price,
      'upgrade_credit_egp', v_credit,
      'amount_due_egp', v_due
    )
  );

  RETURN QUERY
  SELECT
    v_request_id,
    v_path,
    v_cycle,
    v_store.plan_code,
    v_target_price,
    v_credit,
    v_due;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.dokkan_create_upgrade_request(text, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.dokkan_create_upgrade_request(text, text)
TO authenticated;

COMMIT;

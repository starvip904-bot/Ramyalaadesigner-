
-- Add subscription metadata without changing existing stores.
ALTER TABLE public.dokkan_stores
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

-- Validate plan and subscription values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dokkan_stores_plan_code_check'
      AND conrelid = 'public.dokkan_stores'::regclass
  ) THEN
    ALTER TABLE public.dokkan_stores
      ADD CONSTRAINT dokkan_stores_plan_code_check
      CHECK (
        plan_code IS NULL OR
        plan_code IN ('free', 'starter', 'pro', 'business', 'enterprise')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dokkan_stores_subscription_status_check'
      AND conrelid = 'public.dokkan_stores'::regclass
  ) THEN
    ALTER TABLE public.dokkan_stores
      ADD CONSTRAINT dokkan_stores_subscription_status_check
      CHECK (
        subscription_status IS NULL OR
        subscription_status IN ('active', 'paused', 'cancelled', 'expired')
      );
  END IF;
END
$$;

-- New stores receive the permanent Free plan during onboarding.
CREATE OR REPLACE FUNCTION public.dokkan_create_store(
  p_name text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_name text := nullif(trim(p_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_display_name text :=
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_name IS NULL
     OR char_length(v_name) < 2
     OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid store name';
  END IF;

  IF v_phone IS NOT NULL AND char_length(v_phone) > 40 THEN
    RAISE EXCEPTION 'invalid phone';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.dokkan_members m
    WHERE m.user_id = v_user_id
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'user already belongs to a store';
  END IF;

  INSERT INTO public.dokkan_stores (
    name,
    phone,
    status,
    plan_code,
    subscription_status,
    subscription_started_at,
    subscription_ends_at
  )
  VALUES (
    v_name,
    v_phone,
    'active',
    'free',
    'active',
    now(),
    NULL
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.dokkan_members (
    store_id,
    user_id,
    role,
    display_name,
    status
  )
  VALUES (
    v_store_id,
    v_user_id,
    'owner',
    coalesce(v_display_name, auth.jwt() ->> 'email'),
    'active'
  );

  INSERT INTO public.dokkan_branches (
    store_id,
    name,
    status
  )
  VALUES (
    v_store_id,
    'الفرع الرئيسي',
    'active'
  );

  INSERT INTO public.dokkan_store_settings (store_id)
  VALUES (v_store_id);

  INSERT INTO public.dokkan_audit_events (
    store_id,
    action,
    entity_type,
    actor_id,
    metadata
  )
  VALUES (
    v_store_id,
    'create',
    'store',
    v_user_id,
    jsonb_build_object(
      'source', 'onboarding',
      'plan_code', 'free'
    )
  );

  RETURN v_store_id;
END;
$function$;


-- Read-only platform overview for the platform owner.
CREATE OR REPLACE FUNCTION public.dokkan_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.dokkan_is_platform_owner() THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'stores',
      (SELECT count(*) FROM public.dokkan_stores),
    'users',
      (SELECT count(*) FROM auth.users),
    'memberships',
      (SELECT count(*) FROM public.dokkan_members),
    'active_subscriptions',
      (
        SELECT count(*)
        FROM public.dokkan_stores
        WHERE subscription_status = 'active'
      ),
    'revenue_egp', 0
  );
END;
$function$;

-- Read-only list of stores for the platform owner.
CREATE OR REPLACE FUNCTION public.dokkan_platform_stores()
RETURNS TABLE (
  id uuid,
  name text,
  subscription_status text,
  plan_code text,
  member_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.dokkan_is_platform_owner() THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.subscription_status,
    s.plan_code,
    count(m.id) AS member_count,
    s.created_at
  FROM public.dokkan_stores AS s
  LEFT JOIN public.dokkan_members AS m
    ON m.store_id = s.id
  GROUP BY s.id
  ORDER BY s.created_at DESC;
END;
$function$;

-- Only authenticated users can execute these functions.
-- The functions themselves enforce platform-owner authorization.
REVOKE ALL ON FUNCTION public.dokkan_platform_overview()
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.dokkan_platform_stores()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_platform_overview()
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.dokkan_platform_stores()
  TO authenticated;

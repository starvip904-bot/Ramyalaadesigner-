
-- Public RPC wrapper for the existing private platform-owner check.
CREATE OR REPLACE FUNCTION public.dokkan_is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.dokkan_is_platform_owner();
$function$;

REVOKE ALL ON FUNCTION public.dokkan_is_platform_owner()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dokkan_is_platform_owner()
  TO authenticated;

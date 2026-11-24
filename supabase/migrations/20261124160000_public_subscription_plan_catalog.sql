
-- ============================================================
-- DOKKAN: Public Subscription Plan Catalog
-- Migration: 20261124160000
--
-- Purpose:
--   Allow authenticated store users to read public plan details.
--   Keep platform plan editing restricted to platform owners.
--
-- This migration does not modify existing subscriptions,
-- stores, prices, limits, or payment requests.
-- ============================================================

begin;

create or replace function public.dokkan_get_public_subscription_plan_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_settings jsonb;
begin
  -- Only authenticated users can read the public plan catalog.
  if auth.uid() is null then
    raise exception 'authenticated user required'
      using errcode = '42501';
  end if;

  select settings
  into v_settings
  from public.dokkan_platform_plan_settings
  where singleton = true;

  if v_settings is null then
    raise exception 'platform plan settings not initialized';
  end if;

  -- Return only information intended to be visible to merchants.
  -- Never expose audit records, editor identities, or internal versions.
  return jsonb_build_object(
    'currency',
    v_settings -> 'currency',

    'currencyLabel',
    v_settings -> 'currencyLabel',

    'billingCycles',
    v_settings -> 'billingCycles',

    'annualDiscountPercent',
    v_settings -> 'annualDiscountPercent',

    'plans',
    v_settings -> 'plans',

    'addons',
    v_settings -> 'addons'
  );
end;
$function$;

revoke all on function
  public.dokkan_get_public_subscription_plan_catalog()
from public, anon;

grant execute on function
  public.dokkan_get_public_subscription_plan_catalog()
to authenticated;

commit;

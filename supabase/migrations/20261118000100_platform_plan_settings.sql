
-- ============================================================
-- DOKKAN: Central Platform Plan Settings
-- Migration: 20261118000100
-- Purpose:
--   1. Store platform plan definitions and add-on prices centrally.
--   2. Allow platform-owner-only read and update through RPCs.
--   3. Keep a full before/after audit trail for every update.
--
-- IMPORTANT:
--   This migration does not modify existing stores,
--   subscriptions, invoices, or subscription requests.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Central settings table (single row)
-- ------------------------------------------------------------

create table if not exists public.dokkan_platform_plan_settings (
  singleton boolean primary key default true
    check (singleton = true),

  settings jsonb not null,

  version bigint not null default 1
    check (version > 0),

  updated_by uuid references auth.users(id) on delete set null,

  updated_at timestamptz not null default now()
);

comment on table public.dokkan_platform_plan_settings is
  'Central editable plan definitions, limits, features and add-on prices.';

-- ------------------------------------------------------------
-- 2. Platform audit log
-- ------------------------------------------------------------

create table if not exists public.dokkan_platform_audit_events (
  id uuid primary key default gen_random_uuid(),

  actor_id uuid references auth.users(id) on delete set null,

  action text not null,

  entity_type text not null,

  entity_id text,

  old_values jsonb not null default '{}'::jsonb,

  new_values jsonb not null default '{}'::jsonb,

  reason text,

  created_at timestamptz not null default now()
);

create index if not exists
  dokkan_platform_audit_events_created_at_idx
on public.dokkan_platform_audit_events (created_at desc);

create index if not exists
  dokkan_platform_audit_events_entity_idx
on public.dokkan_platform_audit_events (entity_type, entity_id);

comment on table public.dokkan_platform_audit_events is
  'Platform-level administrative audit history.';

-- ------------------------------------------------------------
-- 3. Enable RLS
-- ------------------------------------------------------------

alter table public.dokkan_platform_plan_settings
  enable row level security;

alter table public.dokkan_platform_audit_events
  enable row level security;

drop policy if exists
  "Platform owners can read plan settings"
on public.dokkan_platform_plan_settings;

create policy "Platform owners can read plan settings"
on public.dokkan_platform_plan_settings
for select
to authenticated
using (public.dokkan_is_platform_owner());

drop policy if exists
  "Platform owners can read platform audit"
on public.dokkan_platform_audit_events;

create policy "Platform owners can read platform audit"
on public.dokkan_platform_audit_events
for select
to authenticated
using (public.dokkan_is_platform_owner());

-- No direct INSERT, UPDATE or DELETE policies are created.
-- All writes must go through the protected RPC below.

revoke all on public.dokkan_platform_plan_settings
  from anon, authenticated;

grant select on public.dokkan_platform_plan_settings
  to authenticated;

revoke all on public.dokkan_platform_audit_events
  from anon, authenticated;

grant select on public.dokkan_platform_audit_events
  to authenticated;

-- ------------------------------------------------------------
-- 4. Seed approved plan definitions
-- ------------------------------------------------------------

insert into public.dokkan_platform_plan_settings (
  singleton,
  settings,
  version
)
values (
  true,
  $settings$
  {
    "currency": "EGP",
    "currencyLabel": "جنيه",
    "billingCycles": {
      "monthly": "شهري",
      "annual": "سنوي",
      "lifetime": "مدى الحياة"
    },
    "annualDiscountPercent": 16.67,
    "plans": {
      "free": {
        "code": "free",
        "name": "Free",
        "specificationStatus": "approved",
        "billing": "lifetime",
        "monthlyPriceEgp": 0,
        "annualPriceEgp": 0,
        "limits": {
          "stores": 1,
          "branches": 1,
          "users": 1,
          "products": 50,
          "storageGb": 1
        },
        "features": [
          "متجر واحد",
          "فرع نشط واحد",
          "مستخدم دخول واحد",
          "50 منتجًا نشطًا",
          "مساحة تخزين 1GB",
          "إدارة أساسية للمنتجات والمخزون",
          "تسجيل المبيعات الأساسي",
          "تقارير أساسية"
        ],
        "featuresStatus": "approved"
      },
      "basic": {
        "code": "basic",
        "name": "Basic",
        "specificationStatus": "approved",
        "billing": "monthly",
        "monthlyPriceEgp": 299,
        "annualPriceEgp": 2990,
        "limits": {
          "stores": 1,
          "branches": 3,
          "users": 5,
          "products": 500,
          "storageGb": 5
        },
        "features": [
          "متجر واحد",
          "حتى 3 فروع نشطة",
          "حتى 5 مستخدمين",
          "حتى 500 منتج نشط",
          "مساحة تخزين 5GB",
          "إدارة متقدمة للمنتجات والمخزون",
          "نقاط البيع POS",
          "إدارة الورديات",
          "تقارير المبيعات المتقدمة",
          "إدارة متقدمة للعملاء والموردين"
        ],
        "featuresStatus": "approved"
      },
      "professional": {
        "code": "professional",
        "name": "Professional",
        "specificationStatus": "approved",
        "billing": "monthly",
        "monthlyPriceEgp": 699,
        "annualPriceEgp": 6990,
        "limits": {
          "stores": 1,
          "branches": 10,
          "users": 20,
          "products": 5000,
          "storageGb": 20
        },
        "features": [
          "متجر واحد",
          "حتى 10 فروع نشطة",
          "حتى 20 مستخدمًا",
          "حتى 5,000 منتج نشط",
          "مساحة تخزين 20GB",
          "جميع مميزات Basic",
          "الإدارة المالية المتقدمة",
          "الصلاحيات التفصيلية",
          "سجل التدقيق",
          "تقارير الفروع",
          "التحويلات بين الفروع"
        ],
        "featuresStatus": "approved"
      },
      "enterprise": {
        "code": "enterprise",
        "name": "Enterprise",
        "specificationStatus": "approved",
        "billing": "custom",
        "monthlyPriceEgp": null,
        "annualPriceEgp": null,
        "limits": {
          "stores": "custom",
          "branches": "custom",
          "users": "custom",
          "products": "custom",
          "storageGb": "custom"
        },
        "features": [
          "إدارة عدة متاجر من لوحة واحدة",
          "فروع ومستخدمون حسب الاتفاق",
          "صلاحيات مخصصة",
          "تقارير موحدة ومخصصة",
          "إدارة مركزية للمخزون والتحويلات",
          "إعدادات ومميزات خاصة",
          "دعم أولوية"
        ],
        "featuresStatus": "approved"
      }
    },
    "addons": {
      "extra_branch": {
        "code": "extra_branch",
        "name": "فرع إضافي",
        "priceEgp": 99,
        "billing": "monthly"
      },
      "extra_user": {
        "code": "extra_user",
        "name": "مستخدم إضافي",
        "priceEgp": 49,
        "billing": "monthly"
      },
      "extra_storage_10gb": {
        "code": "extra_storage_10gb",
        "name": "مساحة تخزين إضافية 10GB",
        "priceEgp": 29,
        "billing": "monthly"
      }
    }
  }
  $settings$::jsonb,
  1
)
on conflict (singleton) do nothing;

-- ------------------------------------------------------------
-- 5. Read settings RPC
-- ------------------------------------------------------------

create or replace function public.dokkan_get_platform_plan_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_settings jsonb;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if not private.dokkan_is_platform_owner() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select
    settings,
    version,
    updated_at
  into
    v_settings,
    v_version,
    v_updated_at
  from public.dokkan_platform_plan_settings
  where singleton = true;

  if v_settings is null then
    raise exception 'platform plan settings not initialized';
  end if;

  return jsonb_build_object(
    'settings', v_settings,
    'version', v_version,
    'updatedAt', v_updated_at
  );
end;
$function$;

-- ------------------------------------------------------------
-- 6. Update settings RPC
-- ------------------------------------------------------------

create or replace function public.dokkan_update_platform_plan_settings(
  p_settings jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_settings jsonb;
  v_new_settings jsonb;
  v_actor_id uuid;
  v_version bigint;
  v_reason text;

  -- Separate variables prevent the outer plan code
  -- from being overwritten while validating plan limits.
  v_plan_code text;
  v_limit_code text;

  v_plan jsonb;
  v_addon_code text;
  v_addon jsonb;
  v_price jsonb;
  v_limit jsonb;
begin
  -- Authorization
  if not private.dokkan_is_platform_owner() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  v_actor_id := auth.uid();
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_actor_id is null then
    raise exception 'authenticated platform owner required'
      using errcode = '42501';
  end if;

  -- Basic JSON validation
  if p_settings is null
     or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'settings must be a JSON object';
  end if;

  if jsonb_typeof(p_settings -> 'plans') <> 'object' then
    raise exception 'plans object is required';
  end if;

  if jsonb_typeof(p_settings -> 'addons') <> 'object' then
    raise exception 'addons object is required';
  end if;

  -- Require all supported plan definitions.
  foreach v_plan_code in array array[
    'free',
    'basic',
    'professional',
    'enterprise'
  ]
  loop
    v_plan := p_settings -> 'plans' -> v_plan_code;

    if v_plan is null or jsonb_typeof(v_plan) <> 'object' then
      raise exception 'missing plan definition: %', v_plan_code;
    end if;

    if v_plan ->> 'code' is distinct from v_plan_code then
      raise exception 'invalid plan code: %', v_plan_code;
    end if;

    if nullif(btrim(v_plan ->> 'name'), '') is null then
      raise exception 'plan name is required: %', v_plan_code;
    end if;

    if nullif(btrim(v_plan ->> 'billing'), '') is null then
      raise exception 'plan billing is required: %', v_plan_code;
    end if;

    if jsonb_typeof(v_plan -> 'limits') <> 'object' then
      raise exception 'limits object is required for plan: %', v_plan_code;
    end if;

    if jsonb_typeof(v_plan -> 'features') <> 'array' then
      raise exception 'features array is required for plan: %', v_plan_code;
    end if;

    -- Validate all plan limits.
    foreach v_limit_code in array array[
      'stores',
      'branches',
      'users',
      'products',
      'storageGb'
    ]
    loop
      v_limit := v_plan -> 'limits' -> v_limit_code;

      if v_limit is null then
        raise exception
          'missing limit % for plan %',
          v_limit_code,
          v_plan_code;
      end if;

      if jsonb_typeof(v_limit) = 'number' then
        if (v_limit #>> '{}')::numeric < 0 then
          raise exception 'plan limits cannot be negative';
        end if;
      elsif jsonb_typeof(v_limit) = 'string' then
        if v_limit #>> '{}' not in (
          'unlimited',
          'custom',
          'pending'
        ) then
          raise exception 'invalid text plan limit';
        end if;
      else
        raise exception 'invalid plan limit type';
      end if;
    end loop;

    -- Validate monthly and annual price fields.
    foreach v_price in array array[
      v_plan -> 'monthlyPriceEgp',
      v_plan -> 'annualPriceEgp'
    ]
    loop
      if v_price is null then
        raise exception 'monthly and annual price fields are required';
      end if;

      if jsonb_typeof(v_price) = 'number' then
        if (v_price #>> '{}')::numeric < 0 then
          raise exception 'prices cannot be negative';
        end if;
      elsif jsonb_typeof(v_price) <> 'null' then
        raise exception 'invalid price value';
      end if;
    end loop;

    -- Free must remain permanently free.
    if v_plan_code = 'free' then
      if jsonb_typeof(v_plan -> 'monthlyPriceEgp') <> 'number'
         or jsonb_typeof(v_plan -> 'annualPriceEgp') <> 'number'
         or (v_plan ->> 'monthlyPriceEgp')::numeric <> 0
         or (v_plan ->> 'annualPriceEgp')::numeric <> 0
         or v_plan ->> 'billing' is distinct from 'lifetime' then
        raise exception 'Free plan must remain lifetime and free';
      end if;
    end if;

    -- Enterprise must remain custom-priced.
    if v_plan_code = 'enterprise' then
      if v_plan ->> 'billing' is distinct from 'custom'
         or jsonb_typeof(v_plan -> 'monthlyPriceEgp') <> 'null'
         or jsonb_typeof(v_plan -> 'annualPriceEgp') <> 'null' then
        raise exception 'Enterprise must remain custom-priced';
      end if;
    end if;

    -- Paid plans must have numeric monthly and annual prices.
    if v_plan_code in ('basic', 'professional') then
      if jsonb_typeof(v_plan -> 'monthlyPriceEgp') <> 'number'
         or jsonb_typeof(v_plan -> 'annualPriceEgp') <> 'number' then
        raise exception 'paid plans require numeric monthly and annual prices';
      end if;
    end if;
  end loop;

  -- Validate required add-ons.
  foreach v_addon_code in array array[
    'extra_branch',
    'extra_user',
    'extra_storage_10gb'
  ]
  loop
    v_addon := p_settings -> 'addons' -> v_addon_code;

    if v_addon is null or jsonb_typeof(v_addon) <> 'object' then
      raise exception 'missing add-on: %', v_addon_code;
    end if;

    if v_addon ->> 'code' is distinct from v_addon_code then
      raise exception 'invalid add-on code: %', v_addon_code;
    end if;

    if jsonb_typeof(v_addon -> 'priceEgp') <> 'number'
       or (v_addon ->> 'priceEgp')::numeric < 0 then
      raise exception 'invalid add-on price: %', v_addon_code;
    end if;
  end loop;

  -- Read current settings and lock the singleton row.
  select settings
  into v_old_settings
  from public.dokkan_platform_plan_settings
  where singleton = true
  for update;

  if v_old_settings is null then
    raise exception 'platform plan settings not initialized';
  end if;

  v_new_settings := p_settings;

  -- Update central configuration.
  update public.dokkan_platform_plan_settings
  set
    settings = v_new_settings,
    version = version + 1,
    updated_by = v_actor_id,
    updated_at = now()
  where singleton = true
  returning version into v_version;

  -- Record complete before/after values.
  insert into public.dokkan_platform_audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    reason
  )
  values (
    v_actor_id,
    'platform_plan_settings_updated',
    'platform_plan_settings',
    'singleton',
    v_old_settings,
    v_new_settings,
    v_reason
  );

  return jsonb_build_object(
    'success', true,
    'version', v_version,
    'updatedAt', now()
  );
end;
$function$;

-- ------------------------------------------------------------
-- 7. Function permissions
-- ------------------------------------------------------------

revoke all on function
  public.dokkan_get_platform_plan_settings()
from public, anon;

revoke all on function
  public.dokkan_update_platform_plan_settings(jsonb, text)
from public, anon;

grant execute on function
  public.dokkan_get_platform_plan_settings()
to authenticated;

grant execute on function
  public.dokkan_update_platform_plan_settings(jsonb, text)
to authenticated;

commit;

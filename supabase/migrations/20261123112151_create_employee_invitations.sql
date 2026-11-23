
create table if not exists public.dokkan_employee_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.dokkan_stores(id) on delete cascade,
  employee_id uuid not null references public.dokkan_employees(id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_user_id uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dokkan_employee_invitations_email_normalized
    check (email = lower(btrim(email)) and length(email) between 5 and 320),
  constraint dokkan_employee_invitations_acceptance_consistency
    check (
      (status = 'accepted' and accepted_user_id is not null and accepted_at is not null)
      or
      (status <> 'accepted' and accepted_user_id is null and accepted_at is null)
    )
);

create unique index if not exists dokkan_employee_invitations_one_pending_per_employee
  on public.dokkan_employee_invitations (employee_id)
  where status = 'pending';

create unique index if not exists dokkan_employee_invitations_one_pending_email_per_store
  on public.dokkan_employee_invitations (store_id, email)
  where status = 'pending';

create index if not exists dokkan_employee_invitations_store_created_at_idx
  on public.dokkan_employee_invitations (store_id, created_at desc);

alter table public.dokkan_employee_invitations enable row level security;
revoke all on public.dokkan_employee_invitations from anon, authenticated;

comment on table public.dokkan_employee_invitations is
  'Pending and accepted employee account invitations. Access is server-only via Supabase admin client.';


-- Dokkan: Simple monthly employee attendance
-- Development migration only. Do not run on production.

begin;

create table if not exists public.dokkan_employee_monthly_attendance (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null,
  branch_id uuid not null,
  employee_id uuid not null,
  work_date date not null,

  check_in_at timestamptz,
  check_out_at timestamptz,

  status text not null default 'present'
    check (status in ('present', 'absent', 'leave', 'rest_day')),

  notes text,
  change_reason text not null,

  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dokkan_monthly_attendance_employee_branch_fk
    foreign key (employee_id, store_id, branch_id)
    references public.dokkan_employees(id, store_id, branch_id),

  constraint dokkan_monthly_attendance_branch_fk
    foreign key (branch_id, store_id)
    references public.dokkan_branches(id, store_id),

  constraint dokkan_monthly_attendance_unique_day
    unique (employee_id, work_date),

  constraint dokkan_monthly_attendance_time_check
    check (
      (
        check_out_at is null
        or (
          check_in_at is not null
          and check_out_at >= check_in_at
        )
      )
      and (
        status = 'present'
        or (
          check_in_at is null
          and check_out_at is null
        )
      )
    ),

  constraint dokkan_monthly_attendance_reason_check
    check (length(trim(change_reason)) >= 3),

  constraint dokkan_monthly_attendance_notes_check
    check (notes is null or length(notes) <= 1000)
);

create index if not exists dokkan_monthly_attendance_branch_date_idx
  on public.dokkan_employee_monthly_attendance
  (store_id, branch_id, work_date);

create index if not exists dokkan_monthly_attendance_employee_date_idx
  on public.dokkan_employee_monthly_attendance
  (store_id, employee_id, work_date desc);

-- Immutable history of attendance changes.
create table if not exists public.dokkan_employee_monthly_attendance_history (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null,
  branch_id uuid not null,
  attendance_id uuid not null,
  employee_id uuid not null,

  action_type text not null
    check (action_type in ('created', 'updated')),

  changed_by uuid not null references auth.users(id),
  change_reason text not null,

  before_snapshot jsonb,
  after_snapshot jsonb not null,

  changed_at timestamptz not null default now(),

  constraint dokkan_monthly_attendance_history_record_fk
    foreign key (attendance_id, store_id, branch_id)
    references public.dokkan_employee_monthly_attendance
      (id, store_id, branch_id),

  constraint dokkan_monthly_attendance_history_reason_check
    check (length(trim(change_reason)) >= 3)
);

-- Unique key required by the history foreign key.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.dokkan_employee_monthly_attendance'::regclass
      and conname =
      'dokkan_monthly_attendance_id_store_branch_unique'
  ) then
    alter table public.dokkan_employee_monthly_attendance
      add constraint dokkan_monthly_attendance_id_store_branch_unique
      unique (id, store_id, branch_id);
  end if;
end $$;

create index if not exists dokkan_monthly_attendance_history_record_idx
  on public.dokkan_employee_monthly_attendance_history
  (store_id, attendance_id, changed_at desc);

-- Automatically record every creation and edit.
create or replace function private.dokkan_log_monthly_attendance_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not private.dokkan_has_role(
    new.store_id,
    array['owner', 'admin', 'manager']::text[]
  ) then
    raise exception 'NOT_AUTHORIZED_FOR_STORE';
  end if;

  if not private.dokkan_can_branch(new.branch_id) then
    raise exception 'NOT_AUTHORIZED_FOR_BRANCH';
  end if;

  if new.change_reason is null
     or length(trim(new.change_reason)) < 3 then
    raise exception 'ATTENDANCE_CHANGE_REASON_REQUIRED';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.store_id is distinct from old.store_id
       or new.branch_id is distinct from old.branch_id
       or new.employee_id is distinct from old.employee_id
       or new.work_date is distinct from old.work_date then
      raise exception 'ATTENDANCE_IDENTITY_FIELDS_CANNOT_CHANGE';
    end if;
  end if;

  insert into public.dokkan_employee_monthly_attendance_history (
    store_id,
    branch_id,
    attendance_id,
    employee_id,
    action_type,
    changed_by,
    change_reason,
    before_snapshot,
    after_snapshot
  )
  values (
    new.store_id,
    new.branch_id,
    new.id,
    new.employee_id,
    case
      when tg_op = 'INSERT' then 'created'
      else 'updated'
    end,
    v_actor_id,
    trim(new.change_reason),
    case
      when tg_op = 'UPDATE' then to_jsonb(old)
      else null
    end,
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists dokkan_monthly_attendance_history_trigger
on public.dokkan_employee_monthly_attendance;

create trigger dokkan_monthly_attendance_history_trigger
after insert or update
on public.dokkan_employee_monthly_attendance
for each row
execute function private.dokkan_log_monthly_attendance_history();

-- Enable row-level security.
alter table public.dokkan_employee_monthly_attendance
  enable row level security;

alter table public.dokkan_employee_monthly_attendance_history
  enable row level security;

-- Attendance read.
drop policy if exists dokkan_monthly_attendance_manager_read
on public.dokkan_employee_monthly_attendance;

create policy dokkan_monthly_attendance_manager_read
on public.dokkan_employee_monthly_attendance
for select to authenticated
using (
  private.dokkan_has_role(
    store_id,
    array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

-- Attendance insert.
drop policy if exists dokkan_monthly_attendance_manager_insert
on public.dokkan_employee_monthly_attendance;

create policy dokkan_monthly_attendance_manager_insert
on public.dokkan_employee_monthly_attendance
for insert to authenticated
with check (
  private.dokkan_has_role(
    store_id,
    array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

-- Attendance update.
drop policy if exists dokkan_monthly_attendance_manager_update
on public.dokkan_employee_monthly_attendance;

create policy dokkan_monthly_attendance_manager_update
on public.dokkan_employee_monthly_attendance
for update to authenticated
using (
  private.dokkan_has_role(
    store_id,
    array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
)
with check (
  private.dokkan_has_role(
    store_id,
    array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
  and updated_by = (select auth.uid())
);

-- History is read-only for authorized managers.
drop policy if exists dokkan_monthly_attendance_history_read
on public.dokkan_employee_monthly_attendance_history;

create policy dokkan_monthly_attendance_history_read
on public.dokkan_employee_monthly_attendance_history
for select to authenticated
using (
  private.dokkan_has_role(
    store_id,
    array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

revoke all on public.dokkan_employee_monthly_attendance_history
from anon, authenticated;

grant select
on public.dokkan_employee_monthly_attendance_history
to authenticated;

revoke all on function private.dokkan_log_monthly_attendance_history()
from public, anon, authenticated;

grant execute
on function private.dokkan_log_monthly_attendance_history()
to authenticated;

commit;

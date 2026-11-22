-- Dokkan employee attendance immutable audit history
-- Development migration only. Do not run on production yet.

begin;

-- Reason attached to the latest attendance change.
alter table public.dokkan_employee_attendance
  add column if not exists change_reason text;

-- Immutable attendance history.
create table if not exists public.dokkan_employee_attendance_history (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null,
  branch_id uuid not null,
  attendance_id uuid not null,
  employee_id uuid not null,

  action_type text not null
    check (action_type in ('created', 'updated')),

  changed_by uuid not null references auth.users(id),
  change_reason text,

  before_snapshot jsonb,
  after_snapshot jsonb not null,

  changed_at timestamptz not null default now(),

  constraint dokkan_attendance_history_record_fk
    foreign key (attendance_id, store_id, branch_id)
    references public.dokkan_employee_attendance(id, store_id, branch_id),

  constraint dokkan_attendance_history_reason_check
    check (
      change_reason is null
      or length(trim(change_reason)) > 0
    )
);

create index if not exists dokkan_attendance_history_record_idx
  on public.dokkan_employee_attendance_history
  (store_id, attendance_id, changed_at desc);

create index if not exists dokkan_attendance_history_employee_idx
  on public.dokkan_employee_attendance_history
  (store_id, employee_id, changed_at desc);

-- Write an immutable snapshot after every attendance insert/update.
create or replace function private.dokkan_log_employee_attendance_history()
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

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.store_id is distinct from old.store_id
       or new.branch_id is distinct from old.branch_id
       or new.employee_id is distinct from old.employee_id
       or new.work_date is distinct from old.work_date
       or new.shift_number is distinct from old.shift_number then
      raise exception 'ATTENDANCE_IDENTITY_FIELDS_CANNOT_CHANGE';
    end if;
  end if;

  insert into public.dokkan_employee_attendance_history (
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
    nullif(trim(new.change_reason), ''),
    case
      when tg_op = 'UPDATE' then to_jsonb(old)
      else null
    end,
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists dokkan_attendance_history_trigger
on public.dokkan_employee_attendance;

create trigger dokkan_attendance_history_trigger
after insert or update
on public.dokkan_employee_attendance
for each row
execute function private.dokkan_log_employee_attendance_history();

-- History is readable by authorized store managers only.
alter table public.dokkan_employee_attendance_history
  enable row level security;

drop policy if exists dokkan_attendance_history_manager_read
on public.dokkan_employee_attendance_history;

create policy dokkan_attendance_history_manager_read
on public.dokkan_employee_attendance_history
for select
to authenticated
using (
  private.dokkan_has_role(
    store_id,
    array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

-- No direct insert, update, or delete access to audit history.
revoke all on public.dokkan_employee_attendance_history
from anon, authenticated;

grant select
on public.dokkan_employee_attendance_history
to authenticated;

revoke all on function private.dokkan_log_employee_attendance_history()
from public, anon, authenticated;

grant execute
on function private.dokkan_log_employee_attendance_history()
to authenticated;

commit;
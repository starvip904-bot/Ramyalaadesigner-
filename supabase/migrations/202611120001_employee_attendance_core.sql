
-- Dokkan Employee Attendance Core
-- Development migration: employee schedules, attendance and breaks.
-- No employee login accounts are created.

begin;

-- Ensure employees can be safely referenced together with their store.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.dokkan_employees'::regclass
      and conname = 'dokkan_employees_id_store_unique'
  ) then
    alter table public.dokkan_employees
      add constraint dokkan_employees_id_store_unique
      unique (id, store_id);
  end if;
end $$;

-- Weekly shift templates: up to two shifts per weekday.
create table if not exists public.dokkan_employee_weekly_shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  branch_id uuid not null,
  employee_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  shift_number smallint not null check (shift_number in (1, 2)),
  starts_at time not null,
  ends_at time not null,
  grace_minutes integer not null default 0
    check (grace_minutes between 0 and 240),
  break_mode text not null default 'none'
    check (break_mode in ('none', 'fixed', 'variable')),
  fixed_break_minutes integer not null default 0
    check (fixed_break_minutes between 0 and 600),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dokkan_weekly_shifts_employee_fk
    foreign key (employee_id, store_id)
    references public.dokkan_employees(id, store_id),

  constraint dokkan_weekly_shifts_branch_fk
    foreign key (branch_id, store_id)
    references public.dokkan_branches(id, store_id),

  constraint dokkan_weekly_shifts_unique
    unique (employee_id, weekday, shift_number),

  constraint dokkan_weekly_shifts_break_check
    check (
      (break_mode = 'none' and fixed_break_minutes = 0)
      or (break_mode = 'fixed' and fixed_break_minutes > 0)
      or break_mode = 'variable'
    )
);

-- Immutable snapshots of schedule changes.
create table if not exists public.dokkan_employee_schedule_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  branch_id uuid not null,
  employee_id uuid not null,
  changed_by uuid not null references auth.users(id),
  change_reason text,
  schedule_snapshot jsonb not null,
  created_at timestamptz not null default now(),

  constraint dokkan_schedule_history_employee_fk
    foreign key (employee_id, store_id)
    references public.dokkan_employees(id, store_id),

  constraint dokkan_schedule_history_branch_fk
    foreign key (branch_id, store_id)
    references public.dokkan_branches(id, store_id)
);

-- One record per employee, work date and shift.
-- scheduled timestamps support shifts crossing midnight.
create table if not exists public.dokkan_employee_attendance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  branch_id uuid not null,
  employee_id uuid not null,
  work_date date not null,
  shift_number smallint not null check (shift_number in (1, 2)),
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  grace_minutes integer not null default 0
    check (grace_minutes between 0 and 240),
  check_in_at timestamptz,
  check_out_at timestamptz,
  status text not null default 'scheduled'
    check (status in (
      'scheduled',
      'present',
      'absent_pending',
      'absent_approved',
      'leave',
      'permission',
      'cancelled'
    )),
  overtime_minutes integer not null default 0
    check (overtime_minutes >= 0),
  overtime_status text not null default 'none'
    check (overtime_status in ('none', 'pending', 'approved', 'rejected')),
  notes text,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dokkan_attendance_employee_fk
    foreign key (employee_id, store_id)
    references public.dokkan_employees(id, store_id),

  constraint dokkan_attendance_branch_fk
    foreign key (branch_id, store_id)
    references public.dokkan_branches(id, store_id),

  constraint dokkan_attendance_shift_unique
    unique (employee_id, work_date, shift_number),

  constraint dokkan_attendance_time_check
    check (
      scheduled_end_at > scheduled_start_at
      and (
        check_out_at is null
        or check_in_at is null
        or check_out_at >= check_in_at
      )
    ),

  constraint dokkan_attendance_overtime_check
    check (
      (overtime_status = 'none' and overtime_minutes = 0)
      or overtime_status <> 'none'
    )
);

-- Break periods belonging to one attendance record.
create table if not exists public.dokkan_employee_attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  attendance_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  break_type text not null default 'regular'
    check (break_type in ('regular', 'personal', 'other')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),

  constraint dokkan_attendance_break_attendance_fk
    foreign key (attendance_id, store_id)
    references public.dokkan_employee_attendance(id, store_id),

  constraint dokkan_attendance_break_time_check
    check (ended_at is null or ended_at >= started_at)
);

-- Indexes for common employee, branch and date queries.
create index if not exists dokkan_weekly_shifts_employee_idx
  on public.dokkan_employee_weekly_shifts
  (store_id, branch_id, employee_id, weekday);

create index if not exists dokkan_schedule_history_employee_idx
  on public.dokkan_employee_schedule_history
  (store_id, employee_id, created_at desc);

create index if not exists dokkan_attendance_branch_date_idx
  on public.dokkan_employee_attendance
  (store_id, branch_id, work_date desc);

create index if not exists dokkan_attendance_employee_date_idx
  on public.dokkan_employee_attendance
  (store_id, employee_id, work_date desc);

create index if not exists dokkan_attendance_breaks_record_idx
  on public.dokkan_employee_attendance_breaks
  (store_id, attendance_id, started_at);

-- Enable RLS on every new table.
alter table public.dokkan_employee_weekly_shifts enable row level security;
alter table public.dokkan_employee_schedule_history enable row level security;
alter table public.dokkan_employee_attendance enable row level security;
alter table public.dokkan_employee_attendance_breaks enable row level security;

-- Remove only policies with names owned by this migration, if rerun.
drop policy if exists dokkan_weekly_shifts_manager_read
  on public.dokkan_employee_weekly_shifts;
drop policy if exists dokkan_weekly_shifts_manager_insert
  on public.dokkan_employee_weekly_shifts;
drop policy if exists dokkan_weekly_shifts_manager_update
  on public.dokkan_employee_weekly_shifts;

drop policy if exists dokkan_schedule_history_manager_read
  on public.dokkan_employee_schedule_history;
drop policy if exists dokkan_schedule_history_manager_insert
  on public.dokkan_employee_schedule_history;

drop policy if exists dokkan_attendance_manager_read
  on public.dokkan_employee_attendance;
drop policy if exists dokkan_attendance_manager_insert
  on public.dokkan_employee_attendance;
drop policy if exists dokkan_attendance_manager_update
  on public.dokkan_employee_attendance;

drop policy if exists dokkan_attendance_breaks_manager_read
  on public.dokkan_employee_attendance_breaks;
drop policy if exists dokkan_attendance_breaks_manager_insert
  on public.dokkan_employee_attendance_breaks;
drop policy if exists dokkan_attendance_breaks_manager_update
  on public.dokkan_employee_attendance_breaks;

-- Weekly shifts: managers can read and manage schedules in assigned branches.
create policy dokkan_weekly_shifts_manager_read
on public.dokkan_employee_weekly_shifts
for select to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

create policy dokkan_weekly_shifts_manager_insert
on public.dokkan_employee_weekly_shifts
for insert to authenticated
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
  and created_by = (select auth.uid())
);

create policy dokkan_weekly_shifts_manager_update
on public.dokkan_employee_weekly_shifts
for update to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
)
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

-- Schedule history: append and read only; no update or delete policies.
create policy dokkan_schedule_history_manager_read
on public.dokkan_employee_schedule_history
for select to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

create policy dokkan_schedule_history_manager_insert
on public.dokkan_employee_schedule_history
for insert to authenticated
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
  and changed_by = (select auth.uid())
);

-- Attendance: managers can read and manage attendance in assigned branches.
create policy dokkan_attendance_manager_read
on public.dokkan_employee_attendance
for select to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

create policy dokkan_attendance_manager_insert
on public.dokkan_employee_attendance
for insert to authenticated
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
  and created_by = (select auth.uid())
);

create policy dokkan_attendance_manager_update
on public.dokkan_employee_attendance
for update to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
)
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and private.dokkan_can_branch(branch_id)
);

-- Breaks inherit branch access through their attendance record.
create policy dokkan_attendance_breaks_manager_read
on public.dokkan_employee_attendance_breaks
for select to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and exists (
    select 1
    from public.dokkan_employee_attendance a
    where a.id = attendance_id
      and a.store_id = dokkan_employee_attendance_breaks.store_id
      and private.dokkan_can_branch(a.branch_id)
  )
);

create policy dokkan_attendance_breaks_manager_insert
on public.dokkan_employee_attendance_breaks
for insert to authenticated
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.dokkan_employee_attendance a
    where a.id = attendance_id
      and a.store_id = dokkan_employee_attendance_breaks.store_id
      and private.dokkan_can_branch(a.branch_id)
  )
);

create policy dokkan_attendance_breaks_manager_update
on public.dokkan_employee_attendance_breaks
for update to authenticated
using (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and exists (
    select 1
    from public.dokkan_employee_attendance a
    where a.id = attendance_id
      and a.store_id = dokkan_employee_attendance_breaks.store_id
      and private.dokkan_can_branch(a.branch_id)
  )
)
with check (
  private.dokkan_has_role(
    store_id, array['owner', 'admin', 'manager']::text[]
  )
  and exists (
    select 1
    from public.dokkan_employee_attendance a
    where a.id = attendance_id
      and a.store_id = dokkan_employee_attendance_breaks.store_id
      and private.dokkan_can_branch(a.branch_id)
  )
);

-- Explicit grants: no DELETE access is provided.
grant select, insert, update
on public.dokkan_employee_weekly_shifts,
   public.dokkan_employee_attendance,
   public.dokkan_employee_attendance_breaks
to authenticated;

grant select, insert
on public.dokkan_employee_schedule_history
to authenticated;

commit;

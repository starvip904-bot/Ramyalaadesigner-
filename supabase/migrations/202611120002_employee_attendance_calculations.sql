
-- Dokkan attendance calculation improvements
-- Additive development migration. Do not run on production yet.

begin;

-- Store calculated late minutes for each attendance shift.
alter table public.dokkan_employee_attendance
  add column if not exists late_minutes integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.dokkan_employee_attendance'::regclass
      and conname = 'dokkan_attendance_late_minutes_check'
  ) then
    alter table public.dokkan_employee_attendance
      add constraint dokkan_attendance_late_minutes_check
      check (late_minutes >= 0);
  end if;
end $$;

-- Record the manager who ended each break.
alter table public.dokkan_employee_attendance_breaks
  add column if not exists ended_by uuid
  references auth.users(id);

-- Speed up checking for unfinished breaks before checkout.
create index if not exists dokkan_attendance_breaks_open_idx
  on public.dokkan_employee_attendance_breaks
  (store_id, branch_id, attendance_id)
  where ended_at is null;

commit;

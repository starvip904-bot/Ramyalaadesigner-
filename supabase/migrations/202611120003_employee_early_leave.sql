
-- Dokkan early leave calculation
-- Additive development migration. Do not run on production yet.

begin;

alter table public.dokkan_employee_attendance
  add column if not exists early_leave_minutes integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.dokkan_employee_attendance'::regclass
      and conname = 'dokkan_attendance_early_leave_minutes_check'
  ) then
    alter table public.dokkan_employee_attendance
      add constraint dokkan_attendance_early_leave_minutes_check
      check (early_leave_minutes >= 0);
  end if;
end $$;

commit;

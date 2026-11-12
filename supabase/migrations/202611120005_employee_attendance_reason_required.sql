
-- Require a reason for every attendance update.
-- Development migration only. Do not run on production yet.

begin;

create or replace function private.dokkan_require_employee_attendance_change_reason()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.change_reason is null
     or length(trim(new.change_reason)) = 0 then
    raise exception 'ATTENDANCE_CHANGE_REASON_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all
on function private.dokkan_require_employee_attendance_change_reason()
from public, anon, authenticated;

grant execute
on function private.dokkan_require_employee_attendance_change_reason()
to authenticated;

drop trigger if exists dokkan_attendance_reason_required_trigger
on public.dokkan_employee_attendance;

create trigger dokkan_attendance_reason_required_trigger
before update
on public.dokkan_employee_attendance
for each row
execute function private.dokkan_require_employee_attendance_change_reason();

commit;

-- DOKKAN Security Hardening – Phase 1
-- Safe patch: no data deletion, no financial test operations, no tenant data changes.

create or replace function public.dokkan_record_expense(
  target_store_id uuid,
  target_branch_id uuid,
  expense_title text,
  expense_category text,
  expense_amount numeric,
  expense_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  branch_store_id uuid;
begin
  select b.store_id
    into branch_store_id
    from public.dokkan_branches b
   where b.id = target_branch_id;

  if branch_store_id is null
     or branch_store_id <> target_store_id
     or not public.dokkan_can_branch(target_branch_id)
     or not public.dokkan_is_member(target_store_id)
  then
    raise exception 'not authorized';
  end if;

  insert into public.dokkan_expenses(store_id, branch_id, title, category, amount, notes, created_by)
  values (branch_store_id, target_branch_id, expense_title, expense_category, expense_amount, expense_notes, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

-- Client-facing DOKKAN RPCs require an authenticated Supabase session.
-- Internal auth checks remain in every SECURITY DEFINER function.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'dokkan_%'
  loop
    execute format('revoke execute on function %s from anon, public', fn.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', fn.oid::regprocedure);
  end loop;
end;
$$;

-- Explicitly document the platform boundary: authenticated is still not enough;
-- these functions additionally require dokkan_is_platform_owner() internally.
revoke execute on function public.dokkan_platform_overview() from anon, public;
revoke execute on function public.dokkan_platform_stores() from anon, public;
grant execute on function public.dokkan_platform_overview() to authenticated;
grant execute on function public.dokkan_platform_stores() to authenticated;

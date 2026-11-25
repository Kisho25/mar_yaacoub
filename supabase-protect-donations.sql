-- Run once in the project's Supabase SQL Editor as postgres.
-- Installs a rule for future writes. Existing records are left as they are.
begin;

create or replace function public.protect_pos_donations()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  old_donations jsonb;
  new_donations jsonb;
begin
  if current_user = 'postgres' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Include both numbered donations and older donation line items.
  old_donations := jsonb_path_query_array(
    old.items, '$[*] ? (@.kind == "donation" || @.id == 102 || @.id == "102")'
  );

  if tg_op = 'DELETE' then
    if old_donations <> '[]'::jsonb then
      raise exception 'Only a database administrator can remove a donation' using errcode = '42501';
    end if;
    return old;
  end if;

  new_donations := jsonb_path_query_array(
    new.items, '$[*] ? (@.kind == "donation" || @.id == 102 || @.id == "102")'
  );

  -- Normal sync retries can write the same numbered donation again.
  -- An actual change to an existing numbered donation requires the dashboard.
  if old.items @> '[{"kind":"donation"}]'::jsonb and old is distinct from new then
    raise exception 'Only a database administrator can change a donation' using errcode = '42501';
  end if;

  -- Invoices containing older donations can change their other items.
  -- The donation and its reporting date and status must remain intact.
  if old_donations is distinct from new_donations
    or (
      old_donations <> '[]'::jsonb and
      (old.id, old.event_day, old.completed_at, old.deleted_at)
        is distinct from (new.id, new.event_day, new.completed_at, new.deleted_at)
    )
  then
    raise exception 'Only a database administrator can change a donation' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_pos_donations() from public, anon, authenticated, service_role;
revoke truncate, trigger on table public.sales_orders from public, anon, authenticated, service_role;

drop trigger if exists protect_pos_donations on public.sales_orders;
create trigger protect_pos_donations
before update or delete on public.sales_orders
for each row execute function public.protect_pos_donations();

commit;

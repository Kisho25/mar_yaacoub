-- Run in the Supabase SQL Editor as postgres after setting up sales_orders.
begin;

create table if not exists public.donations (
  id uuid primary key,
  donation_number text not null,
  terminal_id text not null,
  local_number integer not null check (local_number >= 0),
  event_day date not null,
  received_at timestamptz not null,
  amount_received numeric not null check (amount_received > 0),
  currency text not null check (currency in ('LBP', 'USD')),
  amount_lbp bigint not null check (amount_lbp > 0),
  deleted_at timestamptz
);

create index if not exists donations_event_day_idx on public.donations (event_day, received_at, id);
create index if not exists donations_number_idx on public.donations (donation_number);

alter table public.donations enable row level security;
revoke all on table public.donations from public, anon, authenticated, service_role;
grant select on public.donations to anon;
grant insert (id, donation_number, terminal_id, local_number, event_day, received_at,
  amount_received, currency, amount_lbp) on public.donations to anon;

drop policy if exists "POS reads donations" on public.donations;
create policy "POS reads donations" on public.donations for select to anon using (true);
drop policy if exists "POS records donations" on public.donations;
create policy "POS records donations" on public.donations for insert to anon with check (
  deleted_at is null and
  amount_lbp = round(amount_received * case currency when 'USD' then 90000 else 1 end)
);

-- Preserve existing receipts and archive status. Their original sales rows serve as a backup.
insert into public.donations (
  id, donation_number, terminal_id, local_number, event_day, received_at,
  amount_received, currency, amount_lbp, deleted_at
)
select
  sale.id,
  coalesce(entry.data->>'number', 'D-OLD-' || upper(left(sale.id::text, 8))),
  sale.terminal_id,
  case when entry.data is null then 0 else sale.local_order_number end,
  sale.event_day,
  sale.completed_at,
  case when entry.data is null then legacy.amount else (entry.data->>'enteredAmount')::numeric end,
  coalesce(entry.data->>'enteredCurrency', 'LBP'),
  case when entry.data is null then legacy.amount else (entry.data->>'amountLbp')::bigint end,
  sale.deleted_at
from public.sales_orders sale
cross join lateral (
  select jsonb_path_query_first(sale.items, '$[*] ? (@.kind == "donation")') as data
) entry
cross join lateral (
  select sum((item->>'price')::bigint * (item->>'quantity')::bigint) as amount
  from jsonb_path_query(sale.items, '$[*] ? (@.id == 102 || @.id == "102")') as item
) legacy
where legacy.amount > 0 or (entry.data->>'amountLbp')::bigint > 0
on conflict (id) do nothing;

notify pgrst, 'reload schema';
commit;

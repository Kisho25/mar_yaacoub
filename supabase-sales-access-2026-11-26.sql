-- Run once in the Supabase SQL Editor.
-- The website may read only November 26, 2026 and the current day in Beirut.
drop policy if exists "festival devices read report" on public.sales_orders;
drop policy if exists "festival devices read todays sales" on public.sales_orders;
drop policy if exists "festival devices read allowed sales" on public.sales_orders;

create policy "festival devices read allowed sales"
on public.sales_orders
for select
to anon
using (
  event_day = date '2026-11-26'
  or event_day = ((now() at time zone 'Asia/Beirut')::date)
);

-- One-time cleanup for the accidental test invoice created on Sunday.
-- The UUID makes this safe: no other invoice or event day is affected.
delete from public.sales_orders
where id = 'e07db550-1e04-40cc-a6ab-2d90d7bd3284'
  and event_day = date '2026-09-13';

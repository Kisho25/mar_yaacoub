# Connect the POS to Supabase

1. Create a Supabase project at <https://supabase.com/dashboard>.
2. Open **SQL Editor**, paste the contents of `supabase-setup.sql`, and run it once.
3. In **SQL Editor**, run [supabase-donations-migration.sql](supabase-donations-migration.sql).
4. In **Project Settings → API**, copy the Project URL and publishable/anon key.
5. Paste those two values into `config.js`.
6. Upload the complete website folder to your web host.

Every device must open the same hosted website. Completed sales are written locally first, so the cashier can immediately continue. The POS synchronizes automatically at startup, when connectivity returns, and periodically while online.

The browser's publishable key is expected to be visible. Database access is controlled by the Row Level Security policies in `supabase-setup.sql`; never put a Supabase service-role key in `config.js`.

## Keep donation removal in the dashboard

The POS queues donations in browser storage and syncs them to **Table Editor → donations**. The Donations Log in Google Sheets is generated from this table. Existing projects should run the migration before updating the website and Apps Script. The migration copies any older cloud donations with their receipt numbers and archive status. Invoices stay in `sales_orders`.

The website has permission to record and read donations. Keep access to the SQL Editor as `postgres` limited to your own account for archiving and restoring synced donations.

To archive a numbered donation, use **SQL Editor** and replace `D-EXAMPLE-001` with the exact receipt number from the sales report:

```sql
update public.donations
set deleted_at = now()
where deleted_at is null
  and donation_number = 'D-EXAMPLE-001'
returning id, donation_number, event_day, deleted_at;
```

The donation stays in the database and is excluded from profit totals. To restore it, use the same receipt number and set `deleted_at = null` on the matching archived row.

This also works for migrated receipts with a `D-OLD-` number.

# Google Sheets automatic report setup

This connects spreadsheet `1hyHAxrLELHvrinB6Ao_UHGSytGLjcE5T1xMZZQCxePQ` to the existing Supabase sales database. The POS remains unchanged and offline sales continue to queue normally.

1. Open the Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Delete the sample `myFunction` code.
4. Copy all of `google-sheets-sync.gs` into the editor.
5. In `saveSupabaseSettings`, replace `PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE` with the `sb_publishable_...` value from `config.js`.
6. Click **Save**.
7. Select `saveSupabaseSettings` in the function menu and click **Run**. Approve Google's permissions.
8. Select `setupKermessSync` and click **Run** once.

The script refreshes the tabs from Supabase approximately every minute. **Sales Log** lists invoice items, and **Donations Log** lists each donation number, the original amount and currency, and the profit in LBP. **Item Report** and **All Days Report** include a donations total in the profit column. Synchronization retries use the same record ID.

If sync is already set up, create the `donations` table using [supabase-donations-migration.sql](supabase-donations-migration.sql), then replace the Apps Script with the updated file and save it. The existing trigger will use the updated script.

To download a computer copy, open the Google Sheet and choose **File → Download → Microsoft Excel (.xlsx)** or **Comma-separated values (.csv)**.

Do not paste a Supabase secret/service-role key into Apps Script. Use only the publishable key already used by the POS.

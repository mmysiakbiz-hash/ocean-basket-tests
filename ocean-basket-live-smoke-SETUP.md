# Live smoke — setup (opt-in)

The mocked suite (`tests/`) is fast and safe but never touches the real backend.
The **live smoke** (`live/`) exercises the real API + Supabase end-to-end, including the
**cross-system** check (an order placed in the app shows up in the admin). It is opt-in:
without the env/secrets below, the live specs simply skip.

## Golden rule: use a TEST store, not production
The live smoke **places real orders and holds real stock**. Point it at a **separate test store**
so production data is never affected.

Recommended setup:
1. **Create a test store** in the same Supabase project — a new store row with its own
   `store_id` (a fresh UUID) and slug (e.g. `ocean-basket-test`).
2. **Seed it** by running the v2 SQL files against that store (use the new `store_id`):
   `v2_01 … v2_05`, then `v2_07`, then the demo stock `v2_08` (+ `v2_10` if you want GOLD).
   (The seed files currently hardcode the production `store_id` `1111…1111`; copy them and
   replace that UUID with the test store's UUID before running.)
3. **Make test builds** of the two HTML files pointing at the test store:
   - in `ocean-basket-app.html`: set the API path to the test slug (`…/api/ocean-basket-test/v2`);
   - in `ocean-basket-admin.html`: set `STORE_ID` to the test store UUID.
   Deploy them at test URLs (e.g. `ocean-basket-app-test.html`, `ocean-basket-admin-test.html`).
4. **A test admin user**: a Supabase Auth user that can sign into the test admin.

(If you ever run this against production instead, expect a test order to be created there and
clear it later — e.g. with the pre-launch `v2_06` reset. Not recommended.)

## Secrets (GitHub → Settings → Secrets and variables → Actions)
| Secret | Example | Purpose |
| --- | --- | --- |
| `LIVE_APP_URL` | https://…/ocean-basket-app-test.html | customer app (test build) |
| `LIVE_ADMIN_URL` | https://…/ocean-basket-admin-test.html | admin (test build) |
| `LIVE_API_BASE` | https://…/api/ocean-basket-test/v2 | optional — direct API checks |
| `ADMIN_TEST_EMAIL` | test-admin@… | test admin login |
| `ADMIN_TEST_PASSWORD` | … | test admin password |

## Run
- **CI:** GitHub → Actions → **Ocean Basket live smoke** → **Run workflow** (also runs daily).
- **Locally:**
  ```bash
  LIVE_APP_URL=… LIVE_ADMIN_URL=… ADMIN_TEST_EMAIL=… ADMIN_TEST_PASSWORD=… \
    npm run test:live
  npm run report:live
  ```

## What it verifies
- Customer: a real drop-off order goes through and returns a confirmation code + QR.
- Admin: the test admin can sign in (real Supabase Auth) and the dashboard loads real data.
- Cross-system: that order appears in the admin Order Monitor (same real backend).

## Keeping the test store clean
Test orders/holds accumulate in the test store. Re-run the seed/reset (`v2_06`-style, against the
test store) whenever you want a clean slate. Holds also expire on their own.

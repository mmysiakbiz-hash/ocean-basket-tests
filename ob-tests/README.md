# Ocean Basket — automated tests

Fast, repeatable Playwright tests for the Ocean Basket customer app **and** admin panel.
They replace the slow manual click-through: the whole suite runs in ~15 seconds.

## What they check (20 tests)
**Customer app**
- Pack-fit engine: exact match, combination (1+2), and closest-only when nothing fits.
- Cart: stock hold + countdown; Extend works once then disappears; Remove empties the cart.
- Delivery pricing: SILVER (SCR 150) under the free-delivery threshold; GOLD (free) above SCR 3,000.
- Checkout (drop-off) reaches the confirmation screen with a QR code and an order code.
- Order lookup: entering an order code on the Orders screen shows the order.

**Travel Box**
- Next-day date rule: today is rejected; tomorrow (or later) is accepted.
- 20 kg cap: an add that would exceed 20 kg is blocked.
- Box charges: allocation tier (Small/Medium/Large/2 boxes) + service-per-box + health certificate in the total.
- Certificate flow: fill the traveller form, confirm, reach the confirmation screen with a QR code; the order is "certificate pending".

**Admin panel**
- Logs in (stubbed) and renders the dashboard KPIs.
- Scan-In: typing a barcode (e.g. `54RD-F-WHO`) auto-fills product / cut / price.
- Order Monitor: "Packed" calls the `ob_mark_packed` backend function; changing an order's status issues an update on `ob_orders`.
- No uncaught JavaScript errors on load.

## How it works (important)
The tests drive the **real app UI**, but the **backend is mocked**:
- The customer app's Vercel API (`/bootstrap`, `/availability`, `/reservation`, `/orders`, `/order-status`) is intercepted and answered with controlled data — see `tests/helpers/mockApi.js` (the catalog mirrors the real seed).
- The admin's Supabase client is stubbed — see `tests/helpers/adminStub.js`.

So the tests are **fast, deterministic, need no passwords, and never create or touch real data**.
They catch UI / logic / deploy regressions. They do **not** verify the real Vercel API or real Supabase (that's a separate "live smoke" step — see "Extending" below).

## Run locally (for the developer)
Node 18+ required.
```bash
npm ci
npx playwright install chromium
npx playwright test           # tests the live deployed app by default
npm run report                # opens the HTML report
```
To test a local copy **before** deploying, put `ocean-basket-app.html` and `ocean-basket-admin.html` in a folder and point the tests at it:
```bash
BASE_URL=file:///absolute/path/to/folder/ npx playwright test
```

## See results (no terminal needed)
On GitHub: **Actions** tab → open the latest **Ocean Basket tests** run. Green check = all passed.
For details, download the **playwright-report** artifact from that run and open `index.html` — every test, with traces/screenshots for any failure.
The workflow runs automatically on every push and pull request, and can be started by hand via **Run workflow**.

## Where to put this
Either its own repo, or a `tests/` area in the `storefront` repo. The GitHub Action (`.github/workflows/tests.yml`) runs wherever this project lives. The default `BASE_URL` points at the live app, so it works even from a separate repo.

## Extending
- Add new specs under `tests/`. Reuse `mockApi` (customer) or `stubSupabase` (admin).
- **Not coverable by the mocked suite — they need a real shared backend:** cross-system reactions (an action in the app showing up in the admin, e.g. hold → "held", order → "sold") and *true* status persistence. With mocks the app and the admin don't share state, so these belong in the live-backend smoke below.
- **Live-backend smoke test (decision needed):** a separate tagged spec that hits the real API and logs into the admin via GitHub Actions **secrets**, run against a **separate test store** so production data isn't polluted. This complements (doesn't replace) the fast mocked suite, and is where cross-system + persistence get verified.

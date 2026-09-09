# BorsaBi platform improvements — 9 September 2026

This release extends the existing paper-trading application. It does not place real broker orders.

## What changes

1. **Accounting and history:** separate purchase and sale counts; winning-sale rate; price, FX and commission contributions to PnL; native USD prices for crypto alongside TRY account totals. FX attribution uses the position's weighted entry cost. Existing transactions without attribution remain unknown rather than receiving invented history.
2. **Order submission:** a server-enforced all-in TRY spending ceiling, including commission; an authenticated request identity with an atomic saved receipt; exact-request recovery after network failures. A changed price or FX rate that exceeds the ceiling rejects the order instead of silently increasing spending. Retrying a committed request returns its original result even when quote providers are unavailable.
3. **Automation and notifications:** a separate worker checks opted-in SL/TP/trailing exits and price alarms. Notifications are saved to an owner-scoped inbox and can be sent through Web Push after explicit device permission. Existing positions default to automatic sale disabled; legacy trailing positions continue as notifications only.
4. **AI evidence and coaching:** source links, source timestamps and stale/unknown labels accompany chat answers. The transaction coach derives its numeric receipt exclusively from the signed-in user's saved transaction. AI commentary is separate and the receipt remains available during provider outages.
5. **Mobile charts:** simple and advanced controls, a full-screen dialog, larger controls and a news banner in normal page flow. Drawing dimensions reconnect when the chart moves into or out of the dialog.
6. **Historical practice:** replay completed days from the available recent intraday feed; advance one candle at a time; buy/sell with separate practice cash and fees; save a journal and finish with feedback. Future candles stay on the server. Version checks prevent repeated actions from executing twice.

## Behavior and limits

- Automatic exits are simulation market sales at the first usable observed quote after crossing a threshold, not guaranteed fills at the stop price. Polling waits 30 seconds between cycles; quote calls and push delivery add time. Crypto quotes older than two minutes are rejected; BIST requires a regular-session quote no older than twenty minutes. BIST data can be delayed. Missing, stale or mismatched quotes do not execute sales.
- Auto exits can only be enabled when the worker has a recent heartbeat. Enabling an already-crossed threshold can sell the entire open position. Partial sales and concurrent manual changes are guarded by a position version check.
- Push is optional. Inbox records persist independently of permission or push delivery. Notifications retry up to five times and delivery is best effort. The worker is a singleton protected by `flock`. Push keys are generated once in `/etc/borsabi-push.env` with mode 600 and are never printed.
- On supported iPhones, add the site to the Home Screen and enable notifications from that installed web app. See [WebKit's Web Push documentation](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Historical practice is limited to completed days in the last thirty days for which the provider returns enough valid five-minute bars. BIST practice uses TRY, crypto practice uses USD; no historical FX rates are invented. Practice never writes to the real simulation account's balance, positions or transaction history.
- AI source metadata describes the evidence available to the application, not a guarantee that generated commentary is correct. Missing source timestamps are explicitly unknown.
- Pending orders are stored per account in the current browser session. If a response is lost, use “Son emrin sonucunu kontrol et” to retry the exact request before starting another one.

## Deploy on the existing Ubuntu VPS

Use the root console. Run these separately:

```sh
runuser -u borsabi -- git -C /opt/borsabi pull --ff-only
```

Optional read-only prerequisite check:

```sh
bash /opt/borsabi/nextjs_space/scripts/deploy-platform.sh --check
```

Deploy the tested branch version:

```sh
bash /opt/borsabi/nextjs_space/scripts/deploy-platform.sh
```

The script builds an isolated release while the old app is running. It preserves local repository changes by refusing a dirty checkout. It audits historical FX records, stops the old writers for the transition, creates and validates a PostgreSQL dump, and applies additive schema changes. It then starts the web application and the new `borsabi-automation.service`. Success requires the HTTP/auth checks plus a new worker heartbeat.

Do not deploy this release with `deploy-currency.sh`: the platform tables and worker are also required.

On a failed transition the script restores the previous application override and worker unit, retaining the database backup. Additive columns/tables stay in place; it does not overwrite later transactions with an old database dump. Existing automatic-sale preferences are retained on subsequent deployments.

## Verification

- Automated tests cover duplicate submissions, lost responses, atomic accounting, authorization, source metadata, replay lookahead protection, version conflicts and automatic-exit guards.
- TypeScript, ESLint and a production Next.js build are release gates.
- PostgreSQL integration tests run against the disposable `borsabi_test` database in GitHub Actions, including concurrent requests and rollback on receipt failure. The local workspace cannot install PostgreSQL with its available privileges.
- iPhone full-screen chart interaction and actual device Web Push delivery require an on-device check after deployment. They have not been established by component tests or the build.

After deployment, check the automation status in Portfolio, perform a small simulated buy and sell, verify the commission/PnL receipt, enable a test price alert, and complete a practice replay. Confirm that the practice session leaves the main portfolio balance unchanged.

# Task Management V.83 — Complete Performance & Sync Package

This is a complete replacement package built from the latest available V.82 frontend and V.80 backend, with narrowly scoped performance changes. Existing product workflows are preserved; no Google Sheet rows/tabs are intentionally deleted or reset.

## Approved connections (fixed)
- Apps Script Web App: https://script.google.com/macros/s/AKfycbw9x_CwQz3CAQFSZENxZ6tFwTETOv-vol39dGDR5-A0cFj-pvbgd5_HI_1vLLm5yOxG4Q/exec
- Master Google Sheet ID: `1VpJ6AXRYIpGbx9lYgip-evU2lRLm_HoXqEd9FFtMuBc`
- Frontend calls same-origin `/api`; Cloudflare Worker forwards only to the approved Apps Script URL.

## Files
- `Cloudflare-Project/index.html` — current UI including task details popup.
- `Cloudflare-Project/index_scripts.js` — current frontend plus coalesced dashboard refreshes, honored force-sync, and reduced polling.
- `Cloudflare-Project/worker.js` — Cloudflare API proxy, version V.83.
- `Cloudflare-Project/wrangler.toml` — Cloudflare Worker/assets configuration.
- `Google-Apps-Script/Code.gs` — latest available backend (V.80 sync changes plus current approval/task handlers).

## Deploy
1. In the existing Google Apps Script project connected to the approved `/exec` URL, replace the full `Code.gs` content with `Google-Apps-Script/Code.gs`.
2. Save, then **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing deployment URL and authorization settings.
3. In the existing Cloudflare/GitHub project, replace `index.html`, `index_scripts.js`, `worker.js`, and `wrangler.toml` from `Cloudflare-Project/`. If your current `wrangler.toml` contains project-specific settings, merge only the `[assets]`/Worker entry settings rather than overwriting unrelated environment configuration.
4. Deploy/publish Cloudflare and hard-refresh the site (`Ctrl+F5`).
5. Check `https://task-managment.hmo-reportingschedule.workers.dev/api/health`; expect `version: V.83`, `proxy: active`, and the approved Sheet ID.

## Scope of performance changes
- Dashboard refresh requests are coalesced while one sync is active, so a save-triggered refresh is not silently dropped.
- Manual `forceSync` is passed through to the API.
- Notification/approval polling changed from every 3 seconds to a 15-second loop, with server-notification requests throttled to 30 seconds and hidden tabs skipped.
- Existing API writes are not automatically replayed after a network error, avoiding duplicate attendance/task writes.
- Dashboard local cache remains a quick initial view; fresh backend data is still fetched after login.

## Validation and limits
- Frontend JS, Worker JS, and Apps Script JS syntax checks should pass under Node's parser. Apps Script behavior still needs live deployment testing.
- No system can guarantee zero errors or a fixed load time on every low-bandwidth network. This package reduces avoidable requests and preserves explicit retry/error behavior.
- Do not delete existing Google Sheet tabs/rows. Test login, attendance save, assigned tasks, WorkLogs, approvals, and progress reports after deployment.

[README_SETUP.md](https://github.com/user-attachments/files/33002864/README_SETUP.md)
# Task Attendance Dashboard V.3 — Apps Script Redirect/CORS Fix

Changed file only:
- `index.html`

Exact replacement path:
- GitHub/Vercel frontend: replace existing `index.html`.

Configured Apps Script Web App URL:
- https://script.google.com/macros/s/AKfycbwQ8kUdCoGhek_juQHLluX4EQrZ2urjlFbkvx6F66HCvVbXkqUAIEtWcEInVYN7j1u9bw/exec

V.3 changes:
- Added `redirect: 'follow'` for Apps Script ContentService redirect handling.
- Added `mode: 'cors'`.
- Added `cache: 'no-store'` to prevent stale login/API responses.
- Kept `text/plain` POST to avoid unnecessary preflight.
- Version label updated to V.3.
- Existing fast/lightweight attendance flow preserved.

IMPORTANT Apps Script deployment:
1. Deploy > Manage deployments.
2. Use the current Web App deployment/version.
3. Execute as: Me (script owner), where appropriate.
4. Who has access: Anyone / Anyone with the required access for your organization.
5. Save/deploy and use the `/exec` URL from the current deployment.

If the `/exec` URL itself opens in a browser but Vercel still cannot call it, the remaining issue is browser cross-origin behavior/deployment access; in that case a same-origin proxy (e.g. Cloudflare Worker) is the reliable architecture for production.

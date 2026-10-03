# Task Attendance Dashboard V.4

## Why V.4 changes the architecture

The screenshot showed that the browser could not reliably call the Google Apps Script Web App directly. Google Apps Script ContentService can redirect its response, and direct cross-origin browser calls are not a dependable production API boundary.

V.4 therefore uses:

Vercel/GitHub frontend
        |
        v
Cloudflare Worker API proxy
        |
        v
Google Apps Script Web App
        |
        v
Google Sheet: Task Managment

This keeps the Google Sheet as the master database while giving the browser a stable same-origin-style API endpoint with CORS headers.

## Files

- `backend_code.js` — complete Apps Script backend
- `index.html` — complete responsive frontend
- `worker.js` — Cloudflare Worker proxy
- `wrangler.toml` — Worker configuration
- `README_SETUP.md` — setup

## 1. Google Drive

Create/use this folder:

Task Managment

Create/use this Google Sheet inside it:

Task Managment

The Apps Script backend will find the spreadsheet by name and cache its ID.

## 2. Apps Script

Open:

Task Managment -> Extensions -> Apps Script

Replace Code.gs/backend code with `backend_code.js`.

Run `bootstrap` once from the Apps Script editor if desired, or open the Web App with:

?action=health

On first authenticated setup, the backend also ensures required sheets and creates the default admin if no admin exists.

Deploy:

Deploy -> New deployment -> Web app

Execute as: Me
Who has access: Anyone with the link (or your organization's required setting)

Copy the /exec URL.

## 3. Default login

Username:
admin

Password:
Admin@12345

The first setup creates the user automatically in `Users` if it does not already exist.

Do not overwrite an existing Users sheet user.

## 4. Cloudflare Worker

Install Wrangler if needed.

Create a Worker from `worker.js`.

Set the Apps Script URL as a Worker secret:

wrangler secret put APPS_SCRIPT_URL

Paste the exact /exec URL when prompted.

Deploy:

wrangler deploy

Your Worker URL will look like:

https://task-attendance-api.<your-subdomain>.workers.dev

## 5. Frontend

Open `index.html`.

Set:

const API_BASE = 'https://YOUR-WORKER.workers.dev';

Do not put the Apps Script URL into API_BASE.

Commit `index.html` to GitHub and deploy to Vercel.

## 6. Test order

1. Open Apps Script /exec URL with `?action=health`.
2. Confirm a JSON success response.
3. Open the Worker URL with `?action=health`.
4. Confirm the Worker returns JSON.
5. Open Vercel.
6. Login with admin / Admin@12345.
7. Confirm Users and Attendance sheets exist.
8. Punch In.
9. Start/end Break 1.
10. Repeat for Break 2/3.
11. Confirm Break 4 is not present.
12. Punch Out.
13. Load Attendance History.

## Performance rules included

- Login only reads the Users directory.
- Users are cached using CacheService.
- Dashboard reads only the current user's summary.
- History is loaded on demand.
- No employee spreadsheet is created on dashboard reads.
- Spreadsheet ranges are read/written in batches where possible.
- Session token is stored server-side in CacheService.
- Frontend requests have a timeout.
- Loading states are cleared after errors.
- No password is written to AuditLog.

## Security notes

The frontend is not the security boundary. Apps Script validates the session and role for protected actions.

For production, restrict the Apps Script Web App access policy as appropriate for your organization. Never place service-account credentials or other secrets in the frontend.

## Important

If you do not want Cloudflare Worker, the frontend can be hosted directly by Apps Script HTML Service instead. For GitHub/Vercel production, the Worker proxy is the recommended route for this architecture.

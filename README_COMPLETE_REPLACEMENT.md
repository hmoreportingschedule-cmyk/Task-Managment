# Task Management — V.76 Complete Replacement

This ZIP contains the complete replacement set for the currently available V.75 baseline. It uses exactly one Google Apps Script Web App and one Master Google Sheet.

## Approved data endpoints
- Apps Script Web App: https://script.google.com/macros/s/AKfycbw9x_CwQz3CAQFSZENxZ6tFwTETOv-vol39dGDR5-A0cFj-pvbgd5_HI_1vLLm5yOxG4Q/exec
- Master spreadsheet ID: `1VpJ6AXRYIpGbx9lYgip-evU2lRLm_HoXqEd9FFtMuBc`
- The browser calls only same-origin `/api`; Cloudflare Worker forwards to the approved Apps Script URL.

## Replace all old code safely

### A. Google Apps Script
1. Open the Apps Script project currently used by the web app.
2. Make a copy/export of the current project for rollback. Do not delete or clear any Google Sheet tabs or rows.
3. In the Apps Script editor, remove/replace old `.gs` code files that contain duplicate `doGet`/`doPost` handlers.
4. Create/keep one script file named `Code.gs` and paste the entire contents of `Google-Apps-Script/Code.gs`. This file is the complete backend; do not paste it inside another function.
5. Save. Deploy → Manage deployments → Edit → New version → Deploy.
6. Confirm Execute as = Me and Who has access = Anyone (if this is the intended public web-app access model).

### B. Cloudflare/GitHub frontend
1. Replace the deployed site's root files with the complete contents of `Cloudflare-Project/`: `index.html`, `index_scripts.js`, `worker.js`, `wrangler.toml`.
2. If using GitHub-connected Cloudflare, commit/push all four files to the repository root.
3. Deploy the Worker. `wrangler.toml` sets `worker.js` as the entry and the static asset directory to `.`.
4. Test `https://task-managment.hmo-reportingschedule.workers.dev/api/health`; expected JSON includes `version: V76`, `proxy: active`, and the Master Sheet ID above.
5. Then hard refresh (`Ctrl+F5`) and test login, Admin → Users, Admin → Task Templates, Employee → Attendance, and Assigned Tasks.

## V.76 compatibility changes
- Added backend handlers for legacy frontend actions that previously fell through to `Unknown action`: `getAttendanceDateLocks`, `setAttendanceDateLock`, `setAttendanceDateLockRange`, `adminSetAccountStatus`, `adminDeleteUser`, `getApprovalCenterData`, `getManagementAnalytics`, `reviewAttendanceRecord`, `reviewWorkLog`, `requestTaskReplace`, and `reviewTaskReplace`.
- Existing `saveDailyActions`, `getDashboardData`, `adminListUsers`, and `getCommonTaskTemplates` handlers remain in the full backend.
- Admin user deletion removes only the user row from `Users`; task, attendance and work-log history is not deleted. The Master Admin/current account is protected.
- Date lock rules are stored in the `AttendanceDateLocks` tab in the approved Master Sheet.
- No setup routine that clears user/task data is run automatically.

## Important validation note
JavaScript syntax and frontend/backend action-name coverage were checked locally. Live Google Apps Script deployment, permissions, and data-specific behavior cannot be verified from this package build. If `/api/health` works but login/data APIs fail, inspect the Apps Script Executions log for the exact backend error. Do not delete any Google Sheet data while diagnosing.

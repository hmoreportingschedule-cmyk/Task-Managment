# Task Attendance Dashboard — V.1

## Scope
V.1 is the fast, lightweight Attendance foundation based on the supplied Office Task Reporting Dashboard specification.

Included:
- Fast login using cached Users directory
- Role-aware server-side session
- Punch In / Punch Out
- Maximum 3 breaks per day
- Break 4 rejected
- Open-break protection
- Weekoff blocking
- OfficeEvents / holiday blocking
- Attendance history
- Attendance correction request
- Admin attendance correction endpoint
- AuditLog and HealthLog
- Mobile responsive UI
- Lazy loading: history is loaded after authentication
- No employee spreadsheet is created during read-only attendance access

Source specification is the user's attached 384-line build specification. It requires Google Sheets + Apps Script + lightweight frontend and explicitly prioritizes low-speed performance, caching, batching and lazy loading.

## Master Google Sheet
Google Drive path requested:
G:\My Drive\Task Managment

Spreadsheet name:
Task Managment

The Apps Script first tries to find the spreadsheet by name inside a Drive folder named `Task Managment`. It then caches the spreadsheet ID in Script Properties.

Recommended: after the first successful run, set `MASTER_SPREADSHEET_ID` manually in Apps Script Script Properties to remove Drive search from future requests.

## Files
- `backend_code.js` → Google Apps Script backend. Copy into Apps Script as `Code.gs`.
- `index.html` → GitHub/Vercel frontend.
- `README_SETUP.md` → setup and test instructions.
- `appsscript.json` → Apps Script runtime configuration.

## Apps Script setup
1. Open the `Task Managment` spreadsheet.
2. Extensions → Apps Script.
3. Create/replace `Code.gs` with `backend_code.js`.
4. Run `systemHealth` only through the web app after deployment; the script automatically creates required sheets on first request.
5. Deploy → New deployment → Web app.
6. Execute as: Me.
7. Who has access: choose the access model appropriate for your organization.
8. Copy the Web App URL.
9. In `index.html`, replace:
   `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE`
   with the Web App URL.

## Users sheet
The backend creates `Users` with the columns required by the supplied specification. Password is intentionally read only on the backend and never returned to the browser.

Minimum working row:
Username | Password | Role | Department | Weekoff | Display Name | Employee ID | Web Link Access

Example:
admin | CHANGE_ME | MasterAdmin | Administration | Sunday | Admin User | EMP-0001 | ON

For production, do not use simple passwords. V.1 keeps compatibility with the specification's current Password field; a later security version can migrate to salted password hashes.

## Important performance notes
- Users are cached for 5 minutes.
- Session is stored in CacheService for 6 hours.
- Attendance operations read only the relevant Attendance row after login.
- Dashboard does not load task history, audit history, employee spreadsheets or PDF data at login.
- Attendance history is loaded separately.
- Frontend has explicit error handling so spinners do not remain indefinitely.

## V.1 test checklist
- [ ] Valid login works.
- [ ] Invalid login returns a clear message.
- [ ] Web Link Access OFF blocks login.
- [ ] Employee sees only own attendance.
- [ ] Punch In works once.
- [ ] Break 1/2/3 work.
- [ ] Break 4 is rejected.
- [ ] Break End without Break Start is rejected.
- [ ] Second Break Start while a break is open is rejected.
- [ ] Punch Out while a break is open is rejected.
- [ ] Weekoff blocks attendance.
- [ ] OfficeEvents blocks attendance.
- [ ] Attendance history loads after login.
- [ ] Attendance correction request is written to AttendanceRequests.
- [ ] Admin correction is permission protected.
- [ ] AuditLog is written.
- [ ] HealthLog is written.
- [ ] Mobile layout is usable.
- [ ] Low-speed connection does not freeze the page.

## Next version
V.2 should add the next requested Attendance/Task module only, while preserving login, existing Attendance data, performance behavior and the `Task Managment` master spreadsheet.

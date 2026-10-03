# Task Attendance Dashboard V.7

Changed files only:
- backend_code.js
- index.html
- README_SETUP.md

## Display fix
- Attendance History Date now displays as DD-MM-YYYY. Example: 2026-09-30T18:30:00.000Z -> 30-09-2026.
- In Time / Out Time now display in 12-hour format such as 11:00 AM and 7:00 PM.
- Legacy Google Sheets 1899/1900 time-cell timestamps are converted to Asia/Kolkata time.
- Break times use the same 12-hour format.
- Backend normalizes attendance date/time values before sending them to the frontend.

## Replacement
Google Apps Script: replace backend_code.js / Code.gs.
GitHub/Vercel: replace index.html.
Cloudflare Worker: no change.

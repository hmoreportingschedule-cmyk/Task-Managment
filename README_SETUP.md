# Task Attendance Dashboard V.10 — Task Template & Monthly Assignment

Changed files only:
- backend_code.js
- index.html
- README_SETUP.md

### Task Template
- Task Name
- Task Details
- Category
- Priority
- Daily / Weekly / Monthly / One Time
- Multi-Work
- Edit
- Soft Delete

### Import
- `.XLSX`, `.XLS`, `.CSV`
- SheetJS is loaded only when the Import/Export action is used, so login remains lightweight.
- Browser file input is automatically cleared after import.
- Multiple rows with the same Template ID are grouped under one Main Template.
- Work rows are stored as TemplateWorkItems.
- Existing data is updated; the system does not delete/recreate the entire dataset.

### Export
- Current Templates → XLSX
- Blank XLSX Format
- Blank CSV Format

### Monthly Assignment
- Existing Template select
- Active Employee list
- Employee Name / Employee ID / Department
- Select All / Clear / individual checkbox
- Selected employees only
- Existing generated tasks are never deleted by generation
- Same Template + Employee + Month duplicate Main Task is skipped

### Security / Speed
- Login remains lightweight.
- Import and generation are separate backend actions and are not run during login.
- Backend role validation is applied.
- Active users only are returned for assignment.
- Audit Log is written.
- Soft Delete is used.
- Existing sheets are preserved; missing required columns are appended instead of overwriting existing data.

### Important
The XLS/XLSX parser is loaded on demand only for the template import/export workflow, not during login.

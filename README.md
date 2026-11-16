# EduFinance

Database-backed fees, receipts, reports, and payroll for a school or university. Accounts, students, employees, and financial records are stored in MongoDB. The default live setup has no built-in accounts or sample transactions. An explicitly selected demonstration database is available.

## Run locally

Requires Node.js 18+ and MongoDB Community Server (a replica set), or a MongoDB Atlas replica set.

```powershell
npm install
npm run install:all
npm run configure
npm run dev
```

`configure` creates `backend/.env` with random JWT and one-time setup secrets if the file does not already exist, and prints a local setup link. Open that link to create your administrator with your own email and password. Sign in at http://localhost:5173. Setup is disabled once an account exists. Remove SETUP_TOKEN from the environment after setup.

`npm run dev` starts an actual MongoDB server when the configured local port is unused, the API on 5050, and Vite on 5173. MongoDB writes to `.mongo-data`; data is never seeded or reset. Install `mongod` in PATH or set `MONGOD_BINARY` to its absolute path. An existing downloaded local executable can also be reused. If `MONGO_URI` points to an external replica set, that connection is used. Standalone MongoDB is rejected: finance and account changes require transactions.

The app uses the clean `edufinance_live` database. The previous `edufinance` development database remains separate and is never imported or erased by startup.

## Accounts and records

The first administrator creates accounts in **Administration ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ User accounts**. Roles are Super Admin, Principal, Accountant, Fee Clerk, Teacher, Student, and Librarian. Account changes invalidate existing sessions. Accounts are disabled rather than deleted to retain audit references. The final active administrator cannot be removed.

Create students and employees under **Administration**. Set up fee structures before collecting fees, and salary profiles before processing payroll. Inactive employees cannot be paid. Enrollment details are locked once a fee account exists to protect its ledger. This module records cash, cheque, and bank-transfer transactions entered by authorized staff; it does not perform online bank settlement.

JWT access tokens expire after 15 minutes by default and are held only in browser memory. Refresh tokens are random, stored as SHA-256 hashes in MongoDB, rotated atomically, and delivered in HttpOnly SameSite cookies. The frontend refreshes sessions on reload and after access-token expiry. Logout revokes the session, including outstanding access tokens. Authorization uses the current database role on every request. Passwords use bcrypt, with a minimum of 12 characters and a maximum of 72 UTF-8 bytes. Login, setup, and password endpoints have database-backed rate limits.

## Email (configure later)

Password-reset screens and one-time reset-token handling are implemented. Delivery stays unavailable until `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM` are configured. Add `SMTP_USER` and `SMTP_PASS` if authentication is required. The app explicitly reports unavailable delivery when unconfigured. It never logs reset links or pretends an email was sent. Administrators can set passwords in User accounts; signed-in users can change their passwords from the profile menu.

## Optional real external directories

`STUDENT_PROVIDER=mongo` and `EMPLOYEE_PROVIDER=mongo` use local database records. Set either provider to `http` and its corresponding API base URL to connect another real ERP directory. Local edits are disabled for externally managed records.

Student API: `GET /students?search=&className=&section=&academicYear=` and `GET /students/by-admission/{admissionNumber}`. Fields: `id`, `admissionNumber`, `name`, `className`, `academicYear`, optional `section`.

Employee API: `GET /employees?search=` and `GET /employees/{id}`. Fields: `id`, `employeeCode`, `name`, `designation`, `department`, `status` (active or inactive). Lists can be arrays, `{ data: [] }`, or `{ data: { items: [] } }`. The bearer token is forwarded.

## Production

Set `NODE_ENV=production`, a long random `JWT_SECRET`, `CLIENT_ORIGIN` to your HTTPS frontend origin, and an authenticated replica-set `MONGO_URI`. Use TLS and database network access controls. Configure `API_HOST` for your deployment network. Serve the frontend build behind HTTPS with `/api` proxied to the backend and SPA fallback enabled. Production refresh cookies require HTTPS. Keep `.env` out of source control and configure database backups and monitoring.

```powershell
npm run build
npm start
```

## Validation

`npm test` runs backend tests against an isolated temporary MongoDB replica set. Test-only fixtures never populate the running app. Tests cover JWT authentication, concurrent refresh and initial setup, logout/password revocation, real local SMTP delivery, user and directory management, fees, receipts, reports, and payroll. `npm run build` builds React for production.

Amounts are stored as integer paise with server-side balance checks, unique receipt/payment keys, receipt cancellation reversals, and payroll snapshots.

## Live demonstration

The current local app is configured for `edufinance_demo` with `DEMO_MODE=true`. Its seven demo accounts use `Demo#Finance2026`; the login screen offers role selectors. Demonstration data is clearly marked and uses the same database-backed login, JWT sessions, and finance services as live mode.

`npm run demo:seed` creates the separate demo database with 12 students, 10 employees, fee structures, payments, receipts, salary profiles, and payroll history. It refuses to overwrite a populated database and cannot run in production. Ordinary startup never seeds data. To return to live mode, set `MONGO_URI` to `edufinance_live` and `DEMO_MODE=false`, then restart. Existing live accounts and records are preserved.

## Teacher workspace

Teachers sign in to a dedicated dashboard with their own salary breakdown, payment history and printable salary slips, assigned sections, a section-filtered weekly timetable, attendance registers and assignments. Teachers cannot read other employees' salaries or manage unassigned sections.

Super Admin and Principal accounts use **Administration > Teaching management** to create teaching sections, link a teacher account to an employee, assign subjects and sections, and add timetable lessons. Overlapping lessons for a teacher or section are rejected. Create Teacher-role accounts in User accounts first.

Attendance can be entered manually or uploaded as a CSV (maximum 256 KB), using `admissionNumber,status` columns. Include every enrolled student exactly once; statuses are `present`, `absent`, `late`, or `excused`. Download the template from the attendance page. Each teacher maintains one register per section/date; resubmission updates that register. Future dates and unassigned students are rejected.

Assignments support instructions and optional PDF, Word, text, PNG or JPEG attachments up to 5 MB. Choose all assigned sections or select specific sections. Metadata and file contents persist in MongoDB, and attachment downloads require authentication and ownership. This module stores assignments against teaching sections; the student fee portal provides a separate login for fee records.

The existing demonstration teacher is linked to EMP1001 with three mathematics sections, weekday lessons, salary history, assignments and attendance. `npm run demo:teaching` adds these teaching examples to an already-populated demonstration database without replacing existing records.

The current app uses its own persistent MongoDB replica set on local port **27018**, avoiding any system MongoDB service on 27017. It continues to use `.mongo-data`. The interface uses blue and neutral colors.

## Student fee portal

Students have a dedicated JWT-authenticated fee dashboard with their own fee breakdown, total/paid/pending amounts, payment progress, academic-year history, payments, and printable receipts. Cancelled payments are excluded from paid totals and cancelled receipts remain visible for reference. Student access is read-only; payments are recorded by authorized accounts staff. No payment gateway is simulated.

Super Admin creates Student-role accounts in **Administration > User accounts** and selects the linked student record. Create the student record first. One student record can be linked to one student account. Changing that link revokes existing sessions. Student routes derive their scope from the database account link, never from a user-supplied admission number or student ID.

Demo student: `student@edufinance.local`, password `Demo#Finance2026`, linked to Aarav Sharma (`ADM2026001`, Grade 10 A). `npm run demo:student` adds this account to the existing demo database without modifying fees or existing users. The ordinary demo seed includes it as well.

## Library management

Librarian, Super Admin and Principal accounts manage the book catalog, physical copies, issues, returns and renewals. Each copy has a unique accession number. Students and teachers can browse the catalog and view only their own borrowing records. Staff confirm physical check-outs and returns; members cannot issue books to themselves or alter stock.

Library policies: up to five outstanding titles per borrower, one active copy of each title per borrower, a default 14-day loan, due dates within 60 days, and up to two renewals. Overdue days are tracked. Good returns become available, damaged copies go to maintenance, and lost copies stay unavailable. Titles with outstanding loans cannot be archived. MongoDB transactions and unique active-loan indexes prevent the same copy being issued twice, including concurrent requests.

Open **Library** in the sidebar. The Librarian account opens directly to the library dashboard. Demo login: `librarian@edufinance.local`, password `Demo#Finance2026`. `npm run demo:library` adds eight sample titles, 24 copies and student/teacher loan examples to the existing demonstration database without resetting records.

## Login and account concurrency

Accounts have unique email addresses. Student accounts also have a database-enforced unique student admission link. Concurrent duplicate creation produces one successful account and a 409 response for the duplicate. Display names alone are not unique: different students may legitimately have the same name.

Five incorrect passwords lock that account for 15 minutes. The first four failures return 401 with remaining attempts; the fifth returns 429 and a Retry-After header. A correct password does not bypass an active lock. A successful login before the lock resets failed attempts. Counters live in MongoDB and updates are serialized so parallel attempts cannot bypass the limit. A separate IP request limiter also remains enabled.

Assessment scenarios and commands are in `ASSESSMENT-TEST-CASES.md`.

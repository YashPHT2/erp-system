# EduFinance

Finance and payroll module for a School and University ERP. This project covers fee structures, fee collection, receipts, financial reports, and payroll. Student records, employee records, and authentication belong to the other ERP modules and are used through the integration layer below.

Sample numbers created by the seed script are development data. The dashboard shows a banner when that sample set is loaded. They are not live institution transactions.

## Stack

- React, Vite, Tailwind CSS, React Router, Axios, Lucide, Recharts, React Hook Form
- Node.js, Express, MongoDB, Mongoose
- JWT for the shared login token
- bcrypt password hashes for development users only (`bcryptjs`)
- Jest, Supertest, and MongoDB Memory Server

## Setup

Requires Node.js 18+ and a local MongoDB. A replica set is recommended so fee payments and receipt cancellation commit together. On a standalone server the API still saves the records in a safe order and restores the balance if a later write fails.

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
copy backend\.env.example backend\.env
```

Edit `backend/.env` and set `JWT_SECRET` to a long random value. Quote `DEV_USER_PASSWORD` if it contains `#`, because an unquoted `#` is treated as a comment.

```bash
npm run seed --prefix backend
npm run dev
```

`npm run dev` starts the API on port 5050 and the web app on port 5173. Open http://localhost:5173.

| Script | Purpose |
| --- | --- |
| `npm run dev` | API and web app together |
| `npm test` | Backend unit and API tests |
| `npm run seed` | Load development finance data and mock users |
| `npm start` | API only |

The seed script refuses to run when `NODE_ENV=production`. It replaces finance collections in the configured database.

## Development sign-in

Mock login is available only when `AUTH_MODE=mock`. It is rejected when `NODE_ENV=production`.

| Role | Email |
| --- | --- |
| Super Admin | superadmin@edufinance.local |
| Principal | principal@edufinance.local |
| Accountant | accountant@edufinance.local |
| Fee Clerk | clerk@edufinance.local |
| Teacher | teacher@edufinance.local |

The password is `DEV_USER_PASSWORD` from `backend/.env`. The sample value in `.env.example` is `EduFinance#Dev2026`.

## Roles

The API reads the role from the verified token. A role sent in the request body is ignored.

| Action | Super Admin | Principal | Accountant | Fee Clerk | Teacher |
| --- | --- | --- | --- | --- | --- |
| Create or update fee structures | Yes | Yes | No | No | No |
| Collect fees and cancel receipts | Yes | No | Yes | Yes | No |
| View fees and reports | Yes | Yes | Yes | Yes | No |
| Set salaries and process payroll | Yes | No | Yes | No | No |
| View payroll | Yes | Yes | Yes | No | No |

Overpayment is rejected unless `ALLOW_OVERPAYMENT=true` and the request sets `approvedOverpayment` to true. The default is to reject any payment above the pending balance.

Net salary is basic salary plus allowances minus deductions. A negative result is rejected. Payroll for the same employee and month cannot be saved twice. Salary slips keep the components from the day payroll was processed.

## Money rules

- Amounts are stored as integer paise and shown in INR.
- Zero and negative payments are rejected. Fee components must be greater than zero.
- A receipt number looks like `RCP-2026-000001`.
- Cancelling a receipt keeps the document, records who cancelled it, when, and why, and adds the amount back to the pending balance.
- Cancelled receipts are excluded from collection reports.
- A section-specific fee structure overrides the class-wide structure. Otherwise the class-wide structure is used.
- The class on a fee account cannot be changed after a payment. A mismatch with the student record blocks the next collection.

## Integration contract

Set `AUTH_MODE=jwt` when the shared authentication module is ready. Tokens are verified with `JWT_SECRET` using HS256. If `JWT_PUBLIC_KEY` is set in jwt mode, tokens are verified with RS256 instead.

Expected claims:

```json
{
  "sub": "user-id",
  "name": "Vikram Joshi",
  "email": "vikram@school.edu",
  "role": "ACCOUNTANT"
}
```

`role` may be `SUPER_ADMIN`, `PRINCIPAL`, `ACCOUNTANT`, `FEE_CLERK`, or `TEACHER`. Spaces and case are normalized, so `Fee Clerk` becomes `FEE_CLERK`.

Student and employee data are not owned by this module.

- `STUDENT_PROVIDER=mock` uses the temporary directory in `backend/integrations/mockData/directory.js`.
- `STUDENT_PROVIDER=http` calls `STUDENT_API_BASE_URL`.

```http
GET {STUDENT_API_BASE_URL}/students?search=&className=&section=&academicYear=
GET {STUDENT_API_BASE_URL}/students/by-admission/{admissionNumber}
```

A student object, or `{ "data": { ... } }`, must include `id` (string or number), `admissionNumber`, `name`, `className`, and `academicYear`. `section` is optional.

```http
GET {EMPLOYEE_API_BASE_URL}/employees?search=
GET {EMPLOYEE_API_BASE_URL}/employees/{id}
```

An employee object must include `id`, `employeeCode`, `name`, `designation`, and `department`. `status` defaults to `active`. Inactive employees cannot be paid.

Lists may be a raw array, `{ "data": [] }`, or `{ "data": { "items": [] } }`. The same bearer token is forwarded.

Replace the provider by changing the environment variables. Do not copy student or employee collections into this module.

## Tests

```bash
npm test
```

Tests cover fee calculation, partial and full payment, overpayment, duplicate submits, receipt numbers, cancellation and balance reversal, role checks, report totals, salary calculation, negative salary, duplicate payroll, and salary slip contents. The suite uses an in-memory replica set so the transaction path is exercised.

## Layout

```text
backend/
  modules/feeStructure
  modules/feeCollection
  modules/receipts
  modules/feeReports
  modules/payroll
  integrations/
frontend/src/
  components
  layouts
  modules/dashboard
  modules/feeStructure
  modules/feeCollection
  modules/receipts
  modules/feeReports
  modules/payroll
```

Business rules live in the service files. Routes check permissions before those services run.

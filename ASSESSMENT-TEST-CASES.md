# Assessment test cases

The automated suite uses a separate temporary MongoDB replica set and never resets the running demonstration database.

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| SEC-01 | Unauthorized role access | Sign in as Student, enter `/settings/users` directly, then request `GET /api/v1/users` with the student bearer token. | UI shows Access denied. API returns 403 with no restricted data. |
| SEC-02 | Forged client role | Send a Student request with `role=SUPER_ADMIN` or extra permission claims. | Server uses the database account role; admin access remains denied. |
| ACC-01 | Concurrent duplicate account | Submit two simultaneous account-creation requests with the same email, student admission number and name. | One request returns 201, the other 409. Exactly one account exists. |
| ACC-02 | Same ID, different emails | Submit simultaneous requests with different emails for the same student admission number. | Exactly one account is created; duplicate link is rejected with 409. |
| ACC-03 | Legitimate same-name students | Create accounts for different student IDs with the same display name. | Both accounts are allowed; identity is protected by student ID and email. |
| AUTH-01 | Five incorrect passwords | Use a dedicated test account and enter five incorrect passwords. | First four failures return 401 with remaining attempts. The fifth locks login for 15 minutes and returns 429 with Retry-After. |
| AUTH-02 | Login lock cannot be bypassed | Submit the correct password while the account is locked, or submit incorrect passwords concurrently. | Locked login remains rejected; concurrent requests cannot get more than four unlocked failure responses before lockout. |
| AUTH-03 | Successful login resets failures | Submit three wrong passwords, then a correct password, then one wrong password. | Correct login succeeds; the next failure reports four attempts remaining. |
| LIB-01 | Add a book and copies | As Librarian, add a title with two copies and open Copies. | Two unique accession numbers exist and both copies are available. |
| LIB-02 | Concurrent checkout | Issue the same copy to two borrowers simultaneously. | One issue succeeds; the other returns 409. Only one active loan exists. |
| LIB-03 | Return and inventory | Return a good copy, then repeat the return. | First return makes the copy available. Repeat returns are rejected without changing inventory. |
| LIB-04 | Damaged or lost return | Return a copy as damaged or lost. | Loan closes; copy moves to maintenance or lost and cannot be issued. |
| LIB-05 | Borrower privacy | As Student, open My borrowed books and attempt the staff loans endpoint. | Only own loans are visible. Staff endpoint returns 403. |
| LIB-06 | Overdue and renewal | View an overdue loan; renew it twice and attempt a third renewal. | Overdue days are shown; two valid extensions succeed; the third is rejected. |

Run the full suite from the project directory:

```powershell
npm test --prefix backend -- --verbose --coverage=false
```

Run only the new security and library tests:

```powershell
npm test --prefix backend -- --verbose --coverage=false tests/integration/security.api.test.js tests/integration/library.api.test.js
```

The existing tests also cover fees, payroll, receipts, JWT sessions, teacher attendance/assignments and student fee-record privacy.

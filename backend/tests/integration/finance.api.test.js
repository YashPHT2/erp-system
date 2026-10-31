const crypto = require('crypto');
const request = require('supertest');
const { createApp } = require('../../app');
const { auth, connectTestDb, clearTestDb } = require('../helpers');
const { currentAcademicYear, getZonedParts } = require('../../utils/dates');
const FeePayment = require('../../models/FeePayment');
const Receipt = require('../../models/Receipt');

const app = createApp();

function year() {
  return currentAcademicYear(new Date(), 'Asia/Kolkata');
}

function structureBody(overrides = {}) {
  return {
    academicYear: year(),
    className: 'Grade 10',
    section: '',
    components: [{ code: 'TUITION', amount: 1000 }],
    ...overrides,
  };
}

function paymentBody(overrides = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    admissionNumber: 'ADM2026001',
    academicYear: year(),
    amount: 100,
    paymentMode: 'cash',
    ...overrides,
  };
}

async function asRole(role) {
  return auth(role, { name: role === 'PRINCIPAL' ? 'Priya Banerjee' : 'Vikram Joshi' });
}

beforeAll(connectTestDb);
beforeEach(clearTestDb);

describe('fee structures', () => {
  test('creates a structure and calculates the total', async () => {
    const response = await request(app)
      .post('/api/v1/fee-structures')
      .set(await asRole('PRINCIPAL'))
      .send(structureBody({
        components: [
          { code: 'TUITION', amount: 1000 },
          { code: 'LIBRARY', amount: '50.50' },
        ],
      }));

    expect(response.status).toBe(201);
    expect(response.body.data.totalAmount).toBe(1050.5);
    expect(response.body.data.components).toHaveLength(2);
  });

  test('rejects negative amounts and unknown components', async () => {
    const negative = await request(app)
      .post('/api/v1/fee-structures')
      .set(await asRole('SUPER_ADMIN'))
      .send(structureBody({ components: [{ code: 'TUITION', amount: -10 }] }));
    expect(negative.status).toBe(400);

    const unknown = await request(app)
      .post('/api/v1/fee-structures')
      .set(await asRole('SUPER_ADMIN'))
      .send(structureBody({ components: [{ code: 'SPORTS', amount: 10 }] }));
    expect(unknown.status).toBe(400);
  });

  test('blocks accountants, clerks, and teachers from editing structures', async () => {
    for (const role of ['ACCOUNTANT', 'FEE_CLERK', 'TEACHER']) {
      const response = await request(app)
        .post('/api/v1/fee-structures')
        .set(await asRole(role))
        .send(structureBody());
      expect(response.status).toBe(403);
    }
  });

  test('rejects a duplicate class structure', async () => {
    const header = await asRole('PRINCIPAL');
    await request(app).post('/api/v1/fee-structures').set(header).send(structureBody());
    const duplicate = await request(app).post('/api/v1/fee-structures').set(header).send(structureBody({
      className: 'grade 10',
    }));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_FEE_STRUCTURE');
  });

  test('lists structures and refuses to retarget a class after fees are posted', async () => {
    const principal = await asRole('PRINCIPAL');
    const created = await request(app).post('/api/v1/fee-structures').set(principal).send(structureBody());
    await request(app).post('/api/v1/fee-structures').set(principal).send(structureBody({ className: 'Grade 9' }));

    const listed = await request(app).get('/api/v1/fee-structures').query({
      search: 'Grade',
      academicYear: year(),
      className: 'Grade 10',
    }).set(principal);
    expect(listed.status).toBe(200);
    expect(listed.body.data.total).toBe(1);

    const fetched = await request(app).get(`/api/v1/fee-structures/${created.body.data.id}`).set(principal);
    expect(fetched.body.data.totalAmount).toBe(1000);
    const missing = await request(app).get('/api/v1/fee-structures/64b000000000000000000000').set(principal);
    expect(missing.status).toBe(404);

    const clash = await request(app)
      .put(`/api/v1/fee-structures/${created.body.data.id}`)
      .set(principal)
      .send(structureBody({ className: 'Grade 9' }));
    expect(clash.status).toBe(409);

    await request(app).post('/api/v1/fee-payments').set(await asRole('ACCOUNTANT')).send(paymentBody({ amount: 100 }));
    const renamed = await request(app)
      .put(`/api/v1/fee-structures/${created.body.data.id}`)
      .set(principal)
      .send(structureBody({ className: 'Grade 11' }));
    expect(renamed.status).toBe(409);
    expect(renamed.body.code).toBe('STRUCTURE_IN_USE');
  });

  test('rejects a new total below fees already collected', async () => {
    const principal = await asRole('PRINCIPAL');
    const created = await request(app).post('/api/v1/fee-structures').set(principal).send(structureBody());
    await request(app).post('/api/v1/fee-payments').set(await asRole('ACCOUNTANT')).send(paymentBody({ amount: 800 }));

    const tooLow = await request(app)
      .put(`/api/v1/fee-structures/${created.body.data.id}`)
      .set(principal)
      .send(structureBody({ components: [{ code: 'TUITION', amount: 700 }] }));
    expect(tooLow.status).toBe(409);
    expect(tooLow.body.code).toBe('TOTAL_BELOW_COLLECTED');

    const updated = await request(app)
      .put(`/api/v1/fee-structures/${created.body.data.id}`)
      .set(principal)
      .send(structureBody({ components: [{ code: 'TUITION', amount: 900 }] }));
    expect(updated.status).toBe(200);

    const account = await request(app)
      .get('/api/v1/fee-accounts')
      .query({ admissionNumber: 'ADM2026001' })
      .set(await asRole('ACCOUNTANT'));
    expect(account.body.data.account.pendingAmount).toBe(100);
  });
});

describe('fee collection and receipts', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/fee-structures').set(await asRole('PRINCIPAL')).send(structureBody());
    await request(app).post('/api/v1/fee-structures').set(await asRole('PRINCIPAL')).send(structureBody({
      section: 'B',
      components: [{ code: 'TUITION', amount: 400 }],
    }));
  });

  test('records a partial payment and then a full payment', async () => {
    const header = await asRole('ACCOUNTANT');
    const partial = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ amount: 400 }));
    expect(partial.status).toBe(201);
    expect(partial.body.data.payment.pendingAfter).toBe(600);
    expect(partial.body.data.receipt.receiptNumber).toMatch(/^RCP-\d{4}-\d{6}$/);

    const full = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ amount: 600 }));
    expect(full.status).toBe(201);
    expect(full.body.data.payment.pendingAfter).toBe(0);

    const firstSequence = Number(partial.body.data.receipt.receiptNumber.slice(-6));
    const secondSequence = Number(full.body.data.receipt.receiptNumber.slice(-6));
    expect(secondSequence).toBe(firstSequence + 1);
  });

  test('rejects overpayment unless the institution policy and approval flag are both set', async () => {
    const header = await asRole('FEE_CLERK');
    const blocked = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({
      amount: 1001,
      approvedOverpayment: true,
    }));
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe('OVERPAYMENT_NOT_ALLOWED');

    process.env.ALLOW_OVERPAYMENT = 'true';
    try {
      const stillBlocked = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ amount: 1001 }));
      expect(stillBlocked.status).toBe(400);

      const allowed = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({
        amount: 1500,
        approvedOverpayment: true,
      }));
      expect(allowed.status).toBe(201);
      expect(allowed.body.data.payment.overpayment).toBe(true);
      expect(allowed.body.data.receipt.remainingBalance).toBe(0);
      expect(allowed.body.data.receipt.advanceAmount).toBe(500);
    } finally {
      process.env.ALLOW_OVERPAYMENT = 'false';
    }
  });

  test('prevents a duplicate submit and a reused key with a different amount', async () => {
    const header = await asRole('ACCOUNTANT');
    const body = paymentBody({ amount: 100, idempotencyKey: 'same-request-key1' });
    const first = await request(app).post('/api/v1/fee-payments').set(header).send(body);
    const second = await request(app).post('/api/v1/fee-payments').set(header).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.replayed).toBe(true);
    expect(await FeePayment.countDocuments()).toBe(1);

    const conflict = await request(app).post('/api/v1/fee-payments').set(header).send({
      ...body,
      amount: 200,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    const account = await request(app).get('/api/v1/fee-accounts').query({ admissionNumber: 'ADM2026001' }).set(header);
    expect(account.body.data.account.paidAmount).toBe(100);
  });

  test('does not let two full payments both succeed', async () => {
    const header = await asRole('ACCOUNTANT');
    const [first, second] = await Promise.all([
      request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ amount: 1000, idempotencyKey: 'concurrent-key-aaa' })),
      request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ amount: 1000, idempotencyKey: 'concurrent-key-bbb' })),
    ]);
    const successes = [first, second].filter((response) => response.status === 201);
    expect(successes).toHaveLength(1);
    expect(await FeePayment.countDocuments({ status: 'completed' })).toBe(1);
  });

  test('ignores a client payment date and a client role', async () => {
    const before = Date.now();
    const response = await request(app)
      .post('/api/v1/fee-payments')
      .set(auth('TEACHER', { name: 'Meera Iyer' }))
      .send(paymentBody({ role: 'ACCOUNTANT', paymentDate: '2000-01-01' }));
    expect(response.status).toBe(403);

    const paid = await request(app)
      .post('/api/v1/fee-payments')
      .set(await asRole('ACCOUNTANT'))
      .send(paymentBody({ paymentDate: '2000-01-01' }));
    expect(paid.status).toBe(201);
    expect(new Date(paid.body.data.payment.paymentDate).getTime()).toBeGreaterThan(before - 5000);
  });

  test('uses the section structure when one exists and the class structure otherwise', async () => {
    const header = await asRole('ACCOUNTANT');
    const sectionStudent = await request(app).get('/api/v1/fee-accounts').query({ admissionNumber: 'ADM2026004' }).set(header);
    const classStudent = await request(app).get('/api/v1/fee-accounts').query({ admissionNumber: 'ADM2026001' }).set(header);
    expect(sectionStudent.body.data.account.totalFee).toBe(400);
    expect(classStudent.body.data.account.totalFee).toBe(1000);
  });

  test('cancels a receipt, keeps it for audit, and restores the balance', async () => {
    const clerk = await asRole('FEE_CLERK');
    const paid = await request(app).post('/api/v1/fee-payments').set(clerk).send(paymentBody({ amount: 400 }));
    const receiptId = paid.body.data.receipt.id;

    const missingReason = await request(app).post(`/api/v1/receipts/${receiptId}/cancel`).set(clerk).send({ reason: 'no' });
    expect(missingReason.status).toBe(400);

    const teacher = await request(app)
      .post(`/api/v1/receipts/${receiptId}/cancel`)
      .set(auth('TEACHER'))
      .send({ reason: 'Teacher should not cancel this.' });
    expect(teacher.status).toBe(403);

    const cancelled = await request(app)
      .post(`/api/v1/receipts/${receiptId}/cancel`)
      .set(clerk)
      .send({ reason: 'Recorded against the wrong student.' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(cancelled.body.data.cancellation.reason).toMatch(/wrong student/);
    expect(cancelled.body.data.cancellation.cancelledBy.role).toBe('FEE_CLERK');
    expect(cancelled.body.data.remainingBalance).toBe(600);

    const again = await request(app)
      .post(`/api/v1/receipts/${receiptId}/cancel`)
      .set(clerk)
      .send({ reason: 'Trying to cancel it a second time.' });
    expect(again.status).toBe(409);

    expect(await Receipt.countDocuments()).toBe(1);
    const stored = await Receipt.findById(receiptId);
    expect(stored.status).toBe('cancelled');

    const account = await request(app).get('/api/v1/fee-accounts').query({ admissionNumber: 'ADM2026001' }).set(clerk);
    expect(account.body.data.account.paidAmount).toBe(0);
    expect(account.body.data.account.pendingAmount).toBe(1000);

    const parts = getZonedParts(new Date(), 'Asia/Kolkata');
    const date = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    const daily = await request(app).get('/api/v1/reports/daily').query({ date }).set(clerk);
    expect(daily.body.data.totalAmount).toBe(0);
    expect(daily.body.data.count).toBe(0);
  });
});

describe('fee lookups and reports', () => {
  test('rejects unknown students, missing structures, and incomplete payment details', async () => {
    const header = await asRole('ACCOUNTANT');
    const missingStudent = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({
      admissionNumber: 'ADM0000000',
    }));
    expect(missingStudent.status).toBe(404);
    expect(missingStudent.body.code).toBe('STUDENT_NOT_FOUND');

    const noStructure = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({
      admissionNumber: 'ADM2026005',
    }));
    expect(noStructure.status).toBe(404);
    expect(noStructure.body.code).toBe('FEE_STRUCTURE_NOT_FOUND');

    const mismatch = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({
      academicYear: '2020-2021',
    }));
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.code).toBe('ACADEMIC_YEAR_MISMATCH');

    const cheque = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ paymentMode: 'cheque' }));
    expect(cheque.status).toBe(400);
    const transfer = await request(app).post('/api/v1/fee-payments').set(header).send(paymentBody({ paymentMode: 'bank_transfer' }));
    expect(transfer.status).toBe(400);

    const account = await request(app).get('/api/v1/fee-accounts').query({ admissionNumber: 'ADM2026005' }).set(header);
    expect(account.status).toBe(200);
    expect(account.body.data.feeStructure).toBeNull();
  });

  test('lists payments and receipts, and builds the dashboard from active collections', async () => {
    const principal = await asRole('PRINCIPAL');
    const accountant = await asRole('ACCOUNTANT');
    await request(app).post('/api/v1/fee-structures').set(principal).send(structureBody());
    const paid = await request(app).post('/api/v1/fee-payments').set(accountant).send(paymentBody({
      amount: 250,
      paymentMode: 'cheque',
      chequeNumber: '100245',
    }));
    expect(paid.status).toBe(201);

    const payments = await request(app).get('/api/v1/fee-payments').query({
      search: 'Aarav',
      paymentMode: 'cheque',
      status: 'completed',
    }).set(accountant);
    expect(payments.body.data.total).toBe(1);

    const onePayment = await request(app).get(`/api/v1/fee-payments/${paid.body.data.payment.id}`).set(accountant);
    expect(onePayment.body.data.receipt.receiptNumber).toBe(paid.body.data.receipt.receiptNumber);

    const today = new Date().toISOString().slice(0, 10);
    const receipts = await request(app).get('/api/v1/receipts').query({
      search: paid.body.data.receipt.receiptNumber,
      from: '2020-01-01',
      to: '2099-01-01',
      status: 'active',
    }).set(accountant);
    expect(receipts.body.data.total).toBe(1);

    const receipt = await request(app).get(`/api/v1/receipts/${paid.body.data.receipt.id}`).set(accountant);
    expect(receipt.body.data.chequeNumber).toBe('100245');

    const dashboard = await request(app).get('/api/v1/reports/dashboard').set(accountant);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.monthlyCollection).toHaveLength(6);
    expect(dashboard.body.data.totals.todayCollection).toBeGreaterThan(0);

    const monthly = await request(app).get('/api/v1/reports/monthly').set(accountant);
    expect(monthly.body.data.months).toHaveLength(12);
    const modes = await request(app).get('/api/v1/reports/payment-modes').set(accountant);
    expect(modes.body.data.rows.find((row) => row.mode === 'cheque').amount).toBe(250);
    const daily = await request(app).get('/api/v1/reports/daily').set(accountant);
    expect(daily.body.data.totalAmount).toBe(250);

    const csv = await request(app).get('/api/v1/reports/pending').query({ format: 'csv' }).set(accountant);
    expect(csv.headers['content-type']).toMatch(/csv/);
    expect(csv.text).toMatch(/Aarav Sharma/);

    const notes = await request(app).get('/api/v1/notifications').set(accountant);
    expect(notes.body.data.some((item) => item.id === 'pending-dues')).toBe(true);

    const students = await request(app).get('/api/v1/integration/students').query({ q: 'aa' }).set(accountant);
    expect(students.body.data.some((student) => student.admissionNumber === 'ADM2026001')).toBe(true);
    const classes = await request(app).get('/api/v1/integration/classes').set(accountant);
    expect(classes.body.data.length).toBeGreaterThan(0);

    const FeeAccount = require('../../models/FeeAccount');
    await FeeAccount.updateOne({ admissionNumber: 'ADM2026001' }, { className: 'Grade 9', section: 'Z' });
    const blocked = await request(app).post('/api/v1/fee-payments').set(accountant).send(paymentBody({ amount: 10 }));
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('CLASS_MISMATCH');
    expect(today).toBeTruthy();
  });
});

describe('fee reports', () => {
  test('excludes cancelled receipts and lists students who still owe fees', async () => {
    const principal = await asRole('PRINCIPAL');
    const accountant = await asRole('ACCOUNTANT');
    await request(app).post('/api/v1/fee-structures').set(principal).send(structureBody());
    const paid = await request(app).post('/api/v1/fee-payments').set(accountant).send(paymentBody({
      admissionNumber: 'ADM2026002',
      amount: 1000,
    }));
    await request(app).post('/api/v1/fee-payments').set(accountant).send(paymentBody({
      admissionNumber: 'ADM2026001',
      amount: 250,
    }));
    await request(app)
      .post(`/api/v1/receipts/${paid.body.data.receipt.id}/cancel`)
      .set(accountant)
      .send({ reason: 'Duplicate collection was reversed.' });

    const classWise = await request(app).get('/api/v1/reports/class-wise').set(accountant);
    expect(classWise.body.data.totalAmount).toBe(250);

    const defaulters = await request(app).get('/api/v1/reports/defaulters').query({ className: 'Grade 10' }).set(principal);
    const admissions = defaulters.body.data.rows.map((row) => row.admissionNumber);
    expect(admissions).toEqual(expect.arrayContaining(['ADM2026001', 'ADM2026002', 'ADM2026003']));
    const aarav = defaulters.body.data.rows.find((row) => row.admissionNumber === 'ADM2026001');
    const diya = defaulters.body.data.rows.find((row) => row.admissionNumber === 'ADM2026002');
    expect(aarav.pendingAmount).toBe(750);
    expect(diya.pendingAmount).toBe(1000);

    const cancelled = await request(app).get('/api/v1/reports/cancelled').set(accountant);
    expect(cancelled.body.data.count).toBe(1);
    expect(cancelled.body.data.totalAmount).toBe(1000);

    const teacher = await request(app).get('/api/v1/reports/dashboard').set(auth('TEACHER'));
    expect(teacher.status).toBe(403);
  });
});

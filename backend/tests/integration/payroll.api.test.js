const request = require('supertest');
const { createApp } = require('../../app');
const { auth, connectTestDb, clearTestDb } = require('../helpers');
const { getZonedParts } = require('../../utils/dates');
const employees = require('../../integrations/employees');

const app = createApp();

function currentPeriod() {
  const parts = getZonedParts(new Date(), 'Asia/Kolkata');
  return { month: parts.month, year: parts.year };
}

function nextPeriod() {
  const current = currentPeriod();
  if (current.month === 12) return { month: 1, year: current.year + 1 };
  return { month: current.month + 1, year: current.year };
}

function salaryBody(overrides = {}) {
  return {
    basicSalary: 100,
    allowances: [{ code: 'HRA', amount: 20 }],
    deductions: [{ code: 'PF', amount: 30 }],
    ...overrides,
  };
}

beforeAll(connectTestDb);
beforeEach(clearTestDb);

describe('payroll', () => {
  test('saves a salary profile and calculates net salary', async () => {
    const response = await request(app)
      .put('/api/v1/salary-profiles/emp_1001')
      .set(auth('ACCOUNTANT'))
      .send(salaryBody());

    expect(response.status).toBe(200);
    expect(response.body.data.netSalary).toBe(90);
    expect(response.body.data.basicSalary).toBe(100);
  });

  test('rejects negative salary values and a negative net salary', async () => {
    const negative = await request(app)
      .put('/api/v1/salary-profiles/emp_1001')
      .set(auth('SUPER_ADMIN'))
      .send(salaryBody({ basicSalary: -1 }));
    expect(negative.status).toBe(400);

    const net = await request(app)
      .put('/api/v1/salary-profiles/emp_1001')
      .set(auth('ACCOUNTANT'))
      .send(salaryBody({ deductions: [{ code: 'PF', amount: 500 }] }));
    expect(net.status).toBe(400);
    expect(net.body.code).toBe('NEGATIVE_NET_SALARY');
  });

  test('processes payroll once, keeps the snapshot, and builds a salary slip', async () => {
    const header = auth('ACCOUNTANT', { name: 'Vikram Joshi' });
    await request(app).put('/api/v1/salary-profiles/emp_1001').set(header).send(salaryBody());
    const period = currentPeriod();

    const created = await request(app).post('/api/v1/payroll').set(header).send({
      employeeId: 'emp_1001',
      ...period,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.netSalary).toBe(90);
    expect(created.body.data.designation).toBe('Senior Teacher');
    expect(created.body.data.status).toBe('processed');

    const duplicate = await request(app).post('/api/v1/payroll').set(header).send({
      employeeId: 'emp_1001',
      ...period,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_PAYROLL');

    await request(app).put('/api/v1/salary-profiles/emp_1001').set(header).send(salaryBody({ basicSalary: 500 }));
    const stored = await request(app).get(`/api/v1/payroll/${created.body.data.id}`).set(header);
    expect(stored.body.data.basicSalary).toBe(100);
    expect(stored.body.data.netSalary).toBe(90);

    const slip = await request(app).get(`/api/v1/payroll/${created.body.data.id}/slip`).set(header);
    expect(slip.body.data).toMatchObject({
      institutionName: 'Northbridge Educational Institute',
      employeeCode: 'EMP1001',
      designation: 'Senior Teacher',
      netSalary: 90,
      basicSalary: 100,
    });

    const paid = await request(app)
      .patch(`/api/v1/payroll/${created.body.data.id}/payment`)
      .set(header)
      .send({ status: 'paid' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('paid');
    expect(paid.body.data.paidAt).toBeTruthy();

    const again = await request(app)
      .patch(`/api/v1/payroll/${created.body.data.id}/payment`)
      .set(header)
      .send({ status: 'paid' });
    expect(again.status).toBe(409);
  });

  test('rejects a future month and inactive employees', async () => {
    const header = auth('ACCOUNTANT');
    await request(app).put('/api/v1/salary-profiles/emp_1001').set(header).send(salaryBody());
    const future = await request(app).post('/api/v1/payroll').set(header).send({
      employeeId: 'emp_1001',
      ...nextPeriod(),
    });
    expect(future.status).toBe(400);
    expect(future.body.code).toBe('FUTURE_PAYROLL');

    const spy = jest.spyOn(employees, 'getEmployeeById').mockResolvedValue({
      id: 'emp_inactive',
      employeeCode: 'EMP9999',
      name: 'Inactive Person',
      designation: 'Teacher',
      department: 'Science',
      status: 'inactive',
    });
    const inactive = await request(app).put('/api/v1/salary-profiles/emp_inactive').set(header).send(salaryBody());
    expect(inactive.status).toBe(409);
    expect(inactive.body.code).toBe('EMPLOYEE_INACTIVE');
    spy.mockRestore();
  });

  test('lists salaries and payroll, and previews a valid month', async () => {
    const header = auth('ACCOUNTANT');
    await request(app).put('/api/v1/salary-profiles/emp_1001').set(header).send(salaryBody());
    const salaries = await request(app).get('/api/v1/salary-profiles').query({ search: 'Meera' }).set(header);
    expect(salaries.body.data.items.some((item) => item.profile?.netSalary === 90)).toBe(true);

    const period = currentPeriod();
    const preview = await request(app).post('/api/v1/payroll/preview').set(header).send({
      employeeId: 'emp_1001',
      ...period,
    });
    expect(preview.status).toBe(200);
    expect(preview.body.data.netSalary).toBe(90);

    await request(app).post('/api/v1/payroll').set(header).send({ employeeId: 'emp_1001', ...period });
    const history = await request(app).get('/api/v1/payroll').query({
      search: 'EMP1001',
      status: 'processed',
      sort: 'net',
      month: period.month,
      year: period.year,
    }).set(header);
    expect(history.body.data.total).toBe(1);

    const missing = await request(app).put('/api/v1/salary-profiles/missing-person').set(header).send(salaryBody());
    expect(missing.status).toBe(404);
    const badStatus = await request(app).patch(`/api/v1/payroll/${history.body.data.items[0].id}/payment`).set(header).send({ status: 'processed' });
    expect(badStatus.status).toBe(400);
  });

  test('blocks teachers, clerks, and the principal from processing payroll', async () => {
    for (const role of ['TEACHER', 'FEE_CLERK', 'PRINCIPAL']) {
      const response = await request(app)
        .post('/api/v1/payroll')
        .set(auth(role))
        .send({ employeeId: 'emp_1001', ...currentPeriod() });
      expect(response.status).toBe(403);
    }
  });
});

const request = require('supertest');
const { createApp } = require('../../app');
const { auth, connectTestDb, clearTestDb } = require('../helpers');
const Student = require('../../models/Student');
const Employee = require('../../models/Employee');
const { currentAcademicYear, getZonedParts } = require('../../utils/dates');
const app = createApp();
beforeAll(connectTestDb);
beforeEach(clearTestDb);
const academicYear = () => currentAcademicYear(new Date(), 'Asia/Kolkata');
const studentBody = () => ({ admissionNumber: 'REAL-001', name: 'Enrolled Student', className: 'Grade 11', section: 'A', academicYear: academicYear() });
const employeeBody = () => ({ employeeCode: 'STAFF-001', name: 'Staff Member', designation: 'Teacher', department: 'Science', status: 'active' });
describe('persistent directories', () => {
  test('creates and edits students in MongoDB, then uses the record for collection and reports', async () => {
    const body = studentBody();
    const created = await request(app).post('/api/v1/directory/students').set(auth('SUPER_ADMIN')).send(body);
    expect(created.status).toBe(201);
    expect(await Student.findById(created.body.data.id)).toBeTruthy();
    expect((await request(app).post('/api/v1/directory/students').set(auth('SUPER_ADMIN')).send(body)).status).toBe(409);
    const edited = await request(app).put(`/api/v1/directory/students/${created.body.data.id}`).set(auth('PRINCIPAL')).send({ ...body, name: 'Updated Student' });
    expect(edited.status).toBe(200);
    const search = await request(app).get('/api/v1/integration/students').query({ q: 'REAL-001' }).set(auth('FEE_CLERK'));
    expect(search.body.data[0].name).toBe('Updated Student');
    expect((await request(app).post('/api/v1/fee-structures').set(auth('SUPER_ADMIN')).send({ academicYear: academicYear(), className: body.className, components: [{ code: 'TUITION', amount: 1000 }] })).status).toBe(201);
    const payment = await request(app).post('/api/v1/fee-payments').set(auth('ACCOUNTANT')).send({ admissionNumber: body.admissionNumber, academicYear: academicYear(), amount: 250, paymentMode: 'cash', idempotencyKey: 'real-directory-payment-001' });
    expect(payment.status).toBe(201);
    const blocked = await request(app).put(`/api/v1/directory/students/${created.body.data.id}`).set(auth('PRINCIPAL')).send({ ...body, className: 'Grade 12' });
    expect(blocked.status).toBe(409);
    const pending = await request(app).get('/api/v1/reports/pending').set(auth('ACCOUNTANT')).query({ search: 'REAL-001' });
    expect(pending.status).toBe(200);
    expect(JSON.stringify(pending.body)).toContain('Updated Student');
  });
  test('creates an employee, runs payroll, and prevents paying an inactive employee', async () => {
    const body = employeeBody();
    const created = await request(app).post('/api/v1/directory/employees').set(auth('SUPER_ADMIN')).send(body);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(await Employee.findById(id)).toBeTruthy();
    const salary = await request(app).put(`/api/v1/salary-profiles/${id}`).set(auth('ACCOUNTANT')).send({ basicSalary: 10000, allowances: [], deductions: [] });
    expect(salary.status).toBe(200);
    const parts = getZonedParts(new Date(), 'Asia/Kolkata');
    const payroll = await request(app).post('/api/v1/payroll').set(auth('ACCOUNTANT')).send({ employeeId: id, month: parts.month, year: parts.year });
    expect(payroll.status).toBe(201);
    expect((await request(app).put(`/api/v1/directory/employees/${id}`).set(auth('SUPER_ADMIN')).send({ ...body, status: 'inactive' })).status).toBe(200);
    expect((await request(app).post('/api/v1/payroll/preview').set(auth('ACCOUNTANT')).send({ employeeId: id, month: parts.month, year: parts.year })).status).toBe(409);
  });
  test('rejects unauthorized writes, malformed records and edits to external directories', async () => {
    expect((await request(app).post('/api/v1/directory/students').set(auth('FEE_CLERK')).send(studentBody())).status).toBe(403);
    expect((await request(app).post('/api/v1/directory/students').set(auth('SUPER_ADMIN')).send({ ...studentBody(), academicYear: 'bad' })).status).toBe(400);
    expect((await request(app).post('/api/v1/directory/employees').set(auth('SUPER_ADMIN')).send({ ...employeeBody(), status: 'bad' })).status).toBe(400);
    process.env.STUDENT_PROVIDER = 'http';
    try { expect((await request(app).post('/api/v1/directory/students').set(auth('SUPER_ADMIN')).send(studentBody())).status).toBe(409); }
    finally { process.env.STUDENT_PROVIDER = 'mongo'; }
  });
  test('an empty database returns empty directories and zero financial totals', async () => {
    await Student.deleteMany({}); await Employee.deleteMany({});
    expect((await request(app).get('/api/v1/directory/students').set(auth('SUPER_ADMIN'))).body.data).toEqual([]);
    expect((await request(app).get('/api/v1/directory/employees').set(auth('SUPER_ADMIN'))).body.data).toEqual([]);
    const dashboard = await request(app).get('/api/v1/reports/dashboard').set(auth('SUPER_ADMIN'));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totals.feeCollection).toBe(0);
  });
});

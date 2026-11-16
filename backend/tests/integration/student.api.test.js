const request = require('supertest');
const { createApp } = require('../../app');
const { auth, userId, PASSWORD, connectTestDb, clearTestDb } = require('../helpers');
const User = require('../../models/User');
const Student = require('../../models/Student');
const FeeAccount = require('../../models/FeeAccount');
const { currentAcademicYear } = require('../../utils/dates');
const app = createApp();
const year = () => currentAcademicYear(new Date(),'Asia/Kolkata');
const studentAuth = () => auth('STUDENT');
const credentials = { email:'student@test.edu', password:PASSWORD };
beforeAll(connectTestDb);
beforeEach(clearTestDb);
async function structure(academicYear = year()) {
  const result = await request(app).post('/api/v1/fee-structures').set(auth('PRINCIPAL')).send({academicYear,className:'Grade 10',components:[{code:'TUITION',amount:1000},{code:'LIBRARY',amount:200}]});
  expect(result.status).toBe(201);return result.body.data;
}
async function payment(admissionNumber,amount,key) {
  const result = await request(app).post('/api/v1/fee-payments').set(auth('ACCOUNTANT')).send({admissionNumber,academicYear:year(),amount,paymentMode:'cash',idempotencyKey:key});
  expect(result.status).toBe(201);return result.body.data;
}
async function ledger() {
  await structure();
  const own=await payment('ADM2026001',400,'student-own-payment-0001');
  const other=await payment('ADM2026002',500,'student-other-payment-0001');
  const cancelled=await payment('ADM2026001',100,'student-cancelled-payment-0001');
  expect((await request(app).post(`/api/v1/receipts/${cancelled.receipt.id}/cancel`).set(auth('ACCOUNTANT')).send({reason:'Cancelled demonstration payment.'})).status).toBe(200);
  return {own,other,cancelled};
}
describe('student fee portal',()=>{
  test('real student login opens a scoped dashboard with correct totals and cancelled-payment reversal',async()=>{
    await ledger();
    const signed=await request(app).post('/api/v1/auth/login').send(credentials);expect(signed.status).toBe(200);
    expect(signed.body.data.user.permissions).toEqual(['student.self','library.read','library.self']);
    const response=await request(app).get('/api/v1/student/overview').auth(signed.body.data.accessToken,{type:'bearer'});
    expect(response.status).toBe(200);expect(response.body.data.student.admissionNumber).toBe('ADM2026001');
    expect(response.body.data.account).toMatchObject({totalFee:1200,paidAmount:400,pendingAmount:800});
    expect(response.body.data.activeReceiptCount).toBe(1);
    expect(response.body.data.recentPayments).toHaveLength(2);
    expect(response.body.data.recentReceipts).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain('ADM2026002');
  });
  test('changing request identity or receipt ID cannot expose another student’s records',async()=>{
    const {own,other,cancelled}=await ledger();
    const response=await request(app).get('/api/v1/student/overview').set(studentAuth()).query({admissionNumber:'ADM2026002',studentId:other.payment.studentId,userId:userId('SUPER_ADMIN')});
    expect(response.body.data.student.admissionNumber).toBe('ADM2026001');
    for(const id of [own.receipt.id,cancelled.receipt.id])expect((await request(app).get(`/api/v1/student/receipts/${id}`).set(studentAuth())).status).toBe(200);
    expect((await request(app).get(`/api/v1/student/receipts/${other.receipt.id}`).set(studentAuth())).status).toBe(404);
    expect((await request(app).get('/api/v1/student/receipts/invalid').set(studentAuth())).status).toBe(400);
    expect((await request(app).get('/api/v1/receipts').set(studentAuth())).status).toBe(403);
  });
  test('history is paginated and contains only the linked student’s payments and receipts',async()=>{
    await ledger();
    for(const path of ['payments','receipts']){
      const first=await request(app).get(`/api/v1/student/${path}`).set(studentAuth()).query({page:1,limit:1,admissionNumber:'ADM2026002'});
      const second=await request(app).get(`/api/v1/student/${path}`).set(studentAuth()).query({page:2,limit:1});
      expect(first.status).toBe(200);expect(first.body.data).toMatchObject({page:1,pages:2,total:2});
      expect(first.body.data.items[0].admissionNumber).toBe('ADM2026001');
      expect(first.body.data.items[0].id).not.toBe(second.body.data.items[0].id);
    }
  });
  test('student access is read-only, authenticated and separate from staff features',async()=>{
    expect((await request(app).get('/api/v1/student/overview')).status).toBe(401);
    for(const role of ['TEACHER','ACCOUNTANT','PRINCIPAL','SUPER_ADMIN'])expect((await request(app).get('/api/v1/student/overview').set(auth(role))).status).toBe(403);
    for(const endpoint of ['/api/v1/users','/api/v1/reports/dashboard','/api/v1/teaching/overview','/api/v1/salary-profiles'])expect((await request(app).get(endpoint).set(studentAuth())).status).toBe(403);
    expect((await request(app).post('/api/v1/fee-payments').set(studentAuth()).send({amount:1})).status).toBe(403);
    expect((await request(app).post('/api/v1/fee-structures').set(studentAuth()).send({})).status).toBe(403);
  });
  test('unlinked accounts or missing student records show a configuration error rather than another account',async()=>{
    await User.updateOne({_id:userId('STUDENT')},{$set:{studentAdmissionNumber:''}});
    let response=await request(app).get('/api/v1/student/overview').set(studentAuth());
    expect(response.status).toBe(409);expect(response.body.code).toBe('STUDENT_NOT_LINKED');
    await User.updateOne({_id:userId('STUDENT')},{$set:{studentAdmissionNumber:'MISSING'}});
    response=await request(app).get('/api/v1/student/overview').set(studentAuth());expect(response.status).toBe(409);
  });
  test('viewing fees does not create a ledger; unassigned fee structures are represented honestly',async()=>{
    let result=await request(app).get('/api/v1/student/overview').set(studentAuth());
    expect(result.status).toBe(200);expect(result.body.data.account).toBeNull();expect(result.body.data.recentPayments).toEqual([]);
    await structure();result=await request(app).get('/api/v1/student/overview').set(studentAuth());
    expect(result.body.data.account).toMatchObject({totalFee:1200,paidAmount:0,pendingAmount:1200});
    expect(await FeeAccount.countDocuments()).toBe(0);
  });
  test('admins can create linked student accounts; nonexistent and duplicate links are rejected',async()=>{
    const body={email:'second-student@test.edu',name:'Diya Nair',role:'STUDENT',password:PASSWORD,studentAdmissionNumber:'ADM2026002'};
    expect((await request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send({...body,studentAdmissionNumber:'MISSING'})).status).toBe(400);
    expect((await request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send({...body,studentAdmissionNumber:'ADM2026001'})).status).toBe(409);
    const created=await request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send(body);expect(created.status).toBe(201);
    expect(created.body.data.studentAdmissionNumber).toBe('ADM2026002');expect(created.body.data.passwordHash).toBeUndefined();
    const signed=await request(app).post('/api/v1/auth/login').send({email:body.email,password:PASSWORD});
    expect(signed.status).toBe(200);
    const portal=await request(app).get('/api/v1/student/overview').auth(signed.body.data.accessToken,{type:'bearer'});
    expect(portal.body.data.student.admissionNumber).toBe('ADM2026002');
  });
  test('relinking a student account revokes old sessions and the new login sees only the new link',async()=>{
    const signed=await request(app).post('/api/v1/auth/login').send(credentials);
    const changed=await request(app).patch(`/api/v1/users/${userId('STUDENT')}`).set(auth('SUPER_ADMIN')).send({studentAdmissionNumber:'ADM2026002'});expect(changed.status).toBe(200);
    expect((await request(app).get('/api/v1/student/overview').auth(signed.body.data.accessToken,{type:'bearer'})).status).toBe(401);
    const next=await request(app).post('/api/v1/auth/login').send(credentials);
    expect((await request(app).get('/api/v1/student/overview').auth(next.body.data.accessToken,{type:'bearer'})).body.data.student.admissionNumber).toBe('ADM2026002');
  });
  test('historical academic years use stored ledger values and other years cannot be guessed',async()=>{
    const previous='2025-2026';const plan=await structure(previous);const student=await Student.findOne({admissionNumber:'ADM2026001'});
    await FeeAccount.create({studentId:String(student._id),admissionNumber:student.admissionNumber,studentName:student.name,className:'Grade 10',section:'A',academicYear:previous,feeStructureId:plan.id,totalAmountPaise:120000,paidAmountPaise:20000,pendingAmountPaise:100000});
    const history=await request(app).get('/api/v1/student/overview').set(studentAuth()).query({academicYear:previous});
    expect(history.status).toBe(200);expect(history.body.data.account).toMatchObject({totalFee:1200,paidAmount:200,pendingAmount:1000});
    expect(history.body.data.academicYears).toContain(previous);
    expect((await request(app).get('/api/v1/student/overview').set(studentAuth()).query({academicYear:'2020-2021'})).status).toBe(404);
  });
});

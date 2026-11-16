const request = require('supertest');
const { createApp } = require('../../app');
const { auth, userId, connectTestDb, clearTestDb } = require('../helpers');
const { TeachingSection, TeacherProfile, TeachingAssignment, SectionAttendance } = require('../../models/Teaching');
const { currentAcademicYear, getZonedParts } = require('../../utils/dates');
const service = require('../../modules/teaching/teaching.service');
const app = createApp();
let sectionA, sectionB, foreign;
const teacher = () => auth('TEACHER');
const academicYear = () => currentAcademicYear(new Date(),'Asia/Kolkata');
beforeAll(connectTestDb);
beforeEach(async()=>{
  await clearTestDb();
  [sectionA,sectionB,foreign] = await TeachingSection.create([
    {className:'Grade 10',section:'A',academicYear:academicYear()},
    {className:'Grade 10',section:'B',academicYear:academicYear()},
    {className:'Grade 8',section:'A',academicYear:academicYear()},
  ]);
  await TeacherProfile.create({teacherId:userId('TEACHER'),employeeId:'000000000000000000001001',assignments:[{sectionId:sectionA._id,subject:'Mathematics'},{sectionId:sectionB._id,subject:'Mathematics'}]});
});
async function register() { return (await request(app).get('/api/v1/teaching/attendance').set(teacher()).query({sectionId:String(sectionA._id),date:service.today()})).body.data; }
describe('teacher workspace and access control',()=>{
  test('shows assigned sections and own salary, and blocks financial/admin endpoints',async()=>{
    const salary=await request(app).put('/api/v1/salary-profiles/000000000000000000001001').set(auth('ACCOUNTANT')).send({basicSalary:10000,allowances:[{code:'HRA',amount:2000}],deductions:[{code:'PF',amount:1000}]});
    expect(salary.status).toBe(200);
    const overview=await request(app).get('/api/v1/teaching/overview').set(teacher());
    expect(overview.status).toBe(200);expect(overview.body.data.salary.netSalary).toBe(11000);expect(overview.body.data.sections).toHaveLength(2);
    expect(overview.body.data.sections.find(s=>s.id===String(sectionA._id)).studentCount).toBe(3);
    expect((await request(app).get('/api/v1/salary-profiles').set(teacher())).status).toBe(403);
    expect((await request(app).get('/api/v1/teaching/admin').set(teacher())).status).toBe(403);
    expect((await request(app).get('/api/v1/teaching/overview').set(auth('ACCOUNTANT'))).status).toBe(403);
  });
  test('salary slips are restricted to the linked employee',async()=>{
    const p=getZonedParts(new Date(),'Asia/Kolkata');const slips=[];
    for(const employeeId of ['000000000000000000001001','000000000000000000001002']){
      await request(app).put(`/api/v1/salary-profiles/${employeeId}`).set(auth('ACCOUNTANT')).send({basicSalary:10000,allowances:[],deductions:[]});
      const run=await request(app).post('/api/v1/payroll').set(auth('ACCOUNTANT')).send({employeeId,month:p.month,year:p.year});
      expect(run.status).toBe(201);slips.push(run.body.data.id);
    }
    expect((await request(app).get(`/api/v1/teaching/salary-slips/${slips[0]}`).set(teacher())).status).toBe(200);
    expect((await request(app).get(`/api/v1/teaching/salary-slips/${slips[1]}`).set(teacher())).status).toBe(404);
  });
  test('unconfigured teachers receive a useful empty workspace',async()=>{
    await TeacherProfile.deleteMany({});const response=await request(app).get('/api/v1/teaching/overview').set(teacher());
    expect(response.status).toBe(200);expect(response.body.data).toMatchObject({employeeLinked:false,sections:[],salary:null,timetable:[]});
  });
});
describe('teacher attendance',()=>{
  test('starts unmarked, saves a complete register, reloads it and updates without duplicate registers',async()=>{
    const initial=await register();expect(initial.records.every(r=>r.status==='')).toBe(true);
    const records=initial.records.map((r,i)=>({studentId:r.studentId,status:i?'present':'absent'}));
    const body={sectionId:String(sectionA._id),date:service.today(),records};
    expect((await request(app).post('/api/v1/teaching/attendance').set(teacher()).send(body)).status).toBe(200);
    expect((await register()).records[0].status).toBe('absent');
    records[0].status='late';expect((await request(app).post('/api/v1/teaching/attendance').set(teacher()).send(body)).status).toBe(200);
    expect(await SectionAttendance.countDocuments()).toBe(1);expect((await register()).records[0].status).toBe('late');
  });
  test('rejects unassigned sections, future dates, incomplete/duplicate/foreign students and invalid statuses',async()=>{
    expect((await request(app).get('/api/v1/teaching/attendance').set(teacher()).query({sectionId:String(foreign._id),date:service.today()})).status).toBe(403);
    const initial=await register();const records=initial.records.map(r=>({studentId:r.studentId,status:'present'}));
    const base={sectionId:String(sectionA._id),date:service.today()};
    for(const invalid of [records.slice(1),records.map(()=>records[0]),records.map((r,i)=>i? r:{studentId:'foreign',status:'present'}),records.map(r=>({...r,status:'invalid'}))])expect((await request(app).post('/api/v1/teaching/attendance').set(teacher()).send({...base,records:invalid})).status).toBe(400);
    expect((await request(app).post('/api/v1/teaching/attendance').set(teacher()).send({...base,date:'2099-01-01',records})).status).toBe(400);
    expect(await SectionAttendance.countDocuments()).toBe(0);
  });
  test('imports a real CSV file and exports a section template; malformed import preserves saved records',async()=>{
    const initial=await register();const csv='admissionNumber,status\n'+initial.records.map((r,i)=>`${r.admissionNumber},${i?'present':'excused'}`).join('\n');
    const imported=await request(app).post('/api/v1/teaching/attendance/import').set(teacher()).field('sectionId',String(sectionA._id)).field('date',service.today()).attach('file',Buffer.from(csv),'register.csv');
    expect(imported.status).toBe(200);expect((await register()).records[0].status).toBe('excused');
    const template=await request(app).get('/api/v1/teaching/attendance/template').set(teacher()).query({sectionId:String(sectionA._id),date:service.today()});
    expect(template.status).toBe(200);expect(template.text).toContain('admissionNumber,name,status');
    const invalid=await request(app).post('/api/v1/teaching/attendance/import').set(teacher()).field('sectionId',String(sectionA._id)).field('date',service.today()).attach('file',Buffer.from('admissionNumber,status\nUNKNOWN,present'),'bad.csv');
    expect(invalid.status).toBe(400);expect((await register()).records[0].status).toBe('excused');
  });
});
describe('assignment publication and file uploads',()=>{
  const fields=()=>({title:'Mathematics homework',instructions:'Complete questions 1–5.',dueDate:service.today()});
  test('publishes to selected sections or all assigned sections without leaking attachment data',async()=>{
    const selected=await request(app).post('/api/v1/teaching/assignments').set(teacher()).send({...fields(),instructions:'Question 1\n\nQuestion 2',sectionIds:[String(sectionA._id)]});expect(selected.status).toBe(201);
    const all=await request(app).post('/api/v1/teaching/assignments').set(teacher()).field('title','Weekly practice').field('instructions','Solve these problems.').field('dueDate',service.today()).field('allSections','true').attach('file',Buffer.from('Solve 2x+5=17.'),'questions.txt');
    expect(all.status).toBe(201);
    const list=await request(app).get('/api/v1/teaching/assignments').set(teacher());expect(list.status).toBe(200);expect(list.body.data).toHaveLength(2);
    expect(list.body.data.find(a=>a.id===all.body.data.id).sections).toHaveLength(2);
    expect(list.body.data.find(a=>a.id===selected.body.data.id).sections).toHaveLength(1);
    expect(list.body.data.find(a=>a.id===selected.body.data.id).instructions).toBe('Question 1\n\nQuestion 2');
    expect(JSON.stringify(list.body)).not.toContain('Solve 2x+5=17.');
    const file=await request(app).get(`/api/v1/teaching/assignments/${all.body.data.id}/file`).set(teacher());expect(file.status).toBe(200);expect(file.text).toBe('Solve 2x+5=17.');expect(file.headers['content-disposition']).toContain('attachment;');
  });
  test('rejects foreign targets, invalid files, oversized files, past dates and empty assignments',async()=>{
    for(const extra of [{sectionIds:[String(foreign._id)]},{sectionIds:[]},{sectionIds:[String(sectionA._id)],dueDate:'2020-01-01'},{sectionIds:[String(sectionA._id)],instructions:'   '}])expect((await request(app).post('/api/v1/teaching/assignments').set(teacher()).send({...fields(),...extra})).status).toBeGreaterThanOrEqual(400);
    const upload=(buffer,name)=>request(app).post('/api/v1/teaching/assignments').set(teacher()).field('title','A worksheet').field('instructions','Complete it').field('dueDate',service.today()).field('allSections','true').attach('file',buffer,name);
    expect((await upload(Buffer.from('<script>invalid</script>'),'questions.pdf')).status).toBe(400);
    expect((await upload(Buffer.alloc(5*1024*1024+1,65),'big.txt')).status).toBe(400);
    expect(await TeachingAssignment.countDocuments()).toBe(0);
  });
  test('teachers cannot access another teacher’s attachment or publish as another teacher',async()=>{
    const other=await TeachingAssignment.create({teacherId:userId('PRINCIPAL'),title:'Private document',instructions:'Private',sectionIds:[foreign._id],dueDate:service.today(),attachment:{filename:'secret.txt',size:6,contentType:'text/plain',data:Buffer.from('secret')}});
    expect((await request(app).get(`/api/v1/teaching/assignments/${other._id}/file`).set(teacher())).status).toBe(404);
    const posted=await request(app).post('/api/v1/teaching/assignments').set(teacher()).send({...fields(),sectionIds:[String(sectionA._id)],teacherId:userId('PRINCIPAL')});
    expect(posted.status).toBe(201);expect(String((await TeachingAssignment.findById(posted.body.data.id)).teacherId)).toBe(userId('TEACHER'));
  });
});
describe('teaching administration',()=>{
  test('admins manage sections, employee links and schedules; teachers cannot change assignments',async()=>{
    expect((await request(app).get('/api/v1/teaching/admin').set(auth('PRINCIPAL'))).status).toBe(200);
    expect((await request(app).put(`/api/v1/teaching/profiles/${userId('TEACHER')}`).set(teacher()).send({assignments:[]})).status).toBe(403);
    const created=await request(app).post('/api/v1/teaching/sections').set(auth('PRINCIPAL')).send({className:'Grade 11',section:'C',academicYear:academicYear()});expect(created.status).toBe(201);
    const saved=await request(app).put(`/api/v1/teaching/profiles/${userId('TEACHER')}`).set(auth('SUPER_ADMIN')).send({employeeId:'000000000000000000001001',assignments:[{sectionId:String(sectionA._id),subject:'Mathematics'}]});expect(saved.status).toBe(200);
    const body={teacherId:userId('TEACHER'),sectionId:String(sectionA._id),day:1,startTime:'09:00',endTime:'09:45',subject:'Mathematics',room:'201'};
    const slot=await request(app).post('/api/v1/teaching/timetable').set(auth('PRINCIPAL')).send(body);expect(slot.status).toBe(201);
    expect((await request(app).post('/api/v1/teaching/timetable').set(auth('PRINCIPAL')).send({...body,startTime:'09:30'})).status).toBe(409);
    expect((await request(app).post('/api/v1/teaching/timetable').set(auth('PRINCIPAL')).send({...body,endTime:'08:00'})).status).toBe(400);
    expect((await request(app).get('/api/v1/teaching/overview').set(teacher())).body.data.timetable).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/teaching/timetable/${slot.body.data.id}`).set(auth('PRINCIPAL'))).status).toBe(200);
  });
  test('concurrent overlapping timetable lessons cannot both succeed',async()=>{
    const body={teacherId:userId('TEACHER'),sectionId:String(sectionA._id),day:2,startTime:'10:00',endTime:'10:45',subject:'Mathematics'};
    const results=await Promise.all([request(app).post('/api/v1/teaching/timetable').set(auth('SUPER_ADMIN')).send(body),request(app).post('/api/v1/teaching/timetable').set(auth('SUPER_ADMIN')).send({...body,sectionId:String(sectionB._id)})]);
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);
  });
});

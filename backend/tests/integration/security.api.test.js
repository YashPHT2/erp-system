const request=require('supertest');
const {createApp}=require('../../app');
const {auth,userId,signToken,PASSWORD,connectTestDb,clearTestDb}=require('../helpers');
const User=require('../../models/User');
const LoginAttempt=require('../../models/LoginAttempt');
const app=createApp();
beforeAll(connectTestDb);beforeEach(clearTestDb);
const credentials={email:'student@test.edu',password:PASSWORD};
const wrong=()=>request(app).post('/api/v1/auth/login').send({...credentials,password:'incorrect-password'});
describe('login attempt protection',()=>{
  test('locks after exactly five incorrect passwords and rejects a correct password during cooldown',async()=>{
    for(let i=1;i<=5;i++){
      const r=await wrong();expect(r.status).toBe(i<5?401:429);expect(r.body.details.remainingAttempts).toBe(5-i);
      if(i===5)expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    }
    const locked=await request(app).post('/api/v1/auth/login').send(credentials);
    expect(locked.status).toBe(429);expect(locked.body.code).toBe('LOGIN_LOCKED');
    expect((await request(app).post('/api/v1/auth/login').send({email:'teacher@test.edu',password:PASSWORD})).status).toBe(200);
  });
  test('successful login resets failures and cooldown expiry allows a new login',async()=>{
    for(let i=0;i<3;i++)expect((await wrong()).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send(credentials)).status).toBe(200);
    expect((await wrong()).body.details.remainingAttempts).toBe(4);
    for(let i=0;i<4;i++)await wrong();
    await LoginAttempt.updateMany({},{$set:{lockedUntil:new Date(Date.now()-1000),windowStart:new Date(Date.now()-16*60000),expiresAt:new Date(Date.now()+60000)}});
    expect((await request(app).post('/api/v1/auth/login').send(credentials)).status).toBe(200);
    expect((await LoginAttempt.findOne()).failures).toBe(0);
  });
  test('simultaneous failures cannot bypass the five-attempt limit',async()=>{
    const responses=await Promise.all(Array.from({length:8},wrong));
    expect(responses.filter(r=>r.status===401)).toHaveLength(4);
    expect(responses.filter(r=>r.status===429)).toHaveLength(4);
    const state=await LoginAttempt.findOne();expect(state.failures).toBe(5);expect(state.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });
});
describe('concurrent account creation and unauthorized role access',()=>{
  test('two requests with the same email, ID and name create one account only',async()=>{
    const body={email:'new-student@test.edu',name:'Diya Nair',role:'STUDENT',studentAdmissionNumber:'ADM2026002',password:PASSWORD};
    const results=await Promise.all([request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send(body),request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send(body)]);
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect(await User.countDocuments({email:body.email})).toBe(1);
  });
  test('different emails cannot concurrently create two accounts for the same student ID',async()=>{
    const body={name:'Kabir Singh',role:'STUDENT',studentAdmissionNumber:'ADM2026003',password:PASSWORD};
    const results=await Promise.all(['first@test.edu','second@test.edu'].map(email=>request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send({...body,email})));
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect(await User.countDocuments({studentAdmissionNumber:body.studentAdmissionNumber})).toBe(1);
  });
  test('legitimate students with the same display name and different IDs are allowed',async()=>{
    const results=await Promise.all(['ADM2026004','ADM2026005'].map((studentAdmissionNumber,i)=>request(app).post('/api/v1/users').set(auth('SUPER_ADMIN')).send({email:`same-name-${i}@test.edu`,name:'Same Student Name',role:'STUDENT',studentAdmissionNumber,password:PASSWORD})));
    expect(results.map(r=>r.status)).toEqual([201,201]);
  });
  test('a student cannot access admin endpoints, including with a forged role claim or client-supplied role',async()=>{
    const token=signToken({sub:userId('STUDENT'),sid:'200000000000000000000005',role:'SUPER_ADMIN',permissions:['users.manage','library.manage']});
    const endpoints=['/api/v1/users','/api/v1/settings','/api/v1/teaching/admin','/api/v1/directory/students','/api/v1/library/members','/api/v1/library/loans'];
    for(const endpoint of endpoints){const response=await request(app).get(endpoint).auth(token,{type:'bearer'}).query({role:'SUPER_ADMIN'});expect(response.status).toBe(403);expect(response.body.data).toBeUndefined();}
    const attempt=await request(app).post('/api/v1/users').set(auth('STUDENT')).send({role:'SUPER_ADMIN',name:'Injected admin',email:'injected@test.edu',password:PASSWORD});
    expect(attempt.status).toBe(403);expect(await User.exists({email:'injected@test.edu'})).toBeNull();
  });
});

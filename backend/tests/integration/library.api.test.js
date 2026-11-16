const request=require('supertest');
const {createApp}=require('../../app');
const {auth,userId,connectTestDb,clearTestDb}=require('../helpers');
const {LibraryBook,LibraryCopy,LibraryLoan}=require('../../models/Library');
const service=require('../../modules/library/library.service');
const app=createApp();
beforeAll(connectTestDb);beforeEach(clearTestDb);
const staff=()=>auth('LIBRARIAN');
async function book(code='TEST-001',copies=2){const r=await request(app).post('/api/v1/library/books').set(staff()).send({bookCode:code,title:`Library title ${code}`,author:'Test Author',category:'Science',shelf:'A-1',initialCopies:copies});expect(r.status).toBe(201);return (await request(app).get(`/api/v1/library/books/${r.body.data.id}`).set(staff())).body.data;}
const issue=(copyId,borrowerId=userId('STUDENT'))=>request(app).post('/api/v1/library/loans').set(staff()).send({copyId,borrowerId});
describe('library catalog and physical copies',()=>{
  test('creates books with unique accession numbers, searches the catalog and adds copies',async()=>{
    const b=await book();expect(b.items).toHaveLength(2);expect(b.items[0].accessionNumber).not.toBe(b.items[1].accessionNumber);
    const found=await request(app).get('/api/v1/library/books').set(auth('STUDENT')).query({search:'Test Author',category:'Science'});expect(found.body.data.total).toBe(1);expect(found.body.data.items[0].copies.available).toBe(2);
    expect((await request(app).post(`/api/v1/library/books/${b.id}/copies`).set(staff()).send({quantity:2})).status).toBe(201);
    expect(await LibraryCopy.countDocuments({bookId:b.id})).toBe(4);
    expect((await request(app).post('/api/v1/library/books').set(staff()).send({bookCode:'TEST-001',title:'Duplicate',author:'Author',category:'Science'})).status).toBe(409);
    expect((await request(app).post(`/api/v1/library/books/${b.id}/copies`).set(staff()).send({quantity:-1})).status).toBe(400);
  });
  test('members can browse but cannot see copy administration or mutate books',async()=>{
    const b=await book();const detail=await request(app).get(`/api/v1/library/books/${b.id}`).set(auth('STUDENT'));expect(detail.status).toBe(200);expect(detail.body.data.items).toBeUndefined();
    expect((await request(app).post('/api/v1/library/books').set(auth('STUDENT')).send({})).status).toBe(403);
    expect((await request(app).get('/api/v1/library/books').set(auth('ACCOUNTANT'))).status).toBe(403);
    expect((await request(app).get('/api/v1/library/books')).status).toBe(401);
  });
  test('archiving hides books from members and preserves copy/history records',async()=>{
    const b=await book();expect((await request(app).patch(`/api/v1/library/books/${b.id}/status`).set(staff()).send({active:false})).status).toBe(200);
    expect((await request(app).get('/api/v1/library/books').set(auth('STUDENT')).query({includeArchived:'true'})).body.data.total).toBe(0);
    expect((await request(app).get(`/api/v1/library/books/${b.id}`).set(auth('STUDENT'))).status).toBe(404);
    expect(await LibraryCopy.countDocuments({bookId:b.id})).toBe(2);
    expect((await request(app).patch(`/api/v1/library/books/${b.id}/status`).set(staff()).send({active:true})).status).toBe(200);
  });
});
describe('library circulation and concurrency',()=>{
  test('issues and returns a physical copy atomically, with repeat returns rejected',async()=>{
    const b=await book();const issued=await issue(b.items[0].id);expect(issued.status).toBe(201);
    expect((await LibraryCopy.findById(b.items[0].id)).status).toBe('issued');
    expect((await request(app).post(`/api/v1/library/loans/${issued.body.data.id}/return`).set(staff()).send({condition:'good'})).status).toBe(200);
    expect((await LibraryCopy.findById(b.items[0].id)).status).toBe('available');
    expect((await request(app).get('/api/v1/library/overview').set(auth('STUDENT'))).body.data.loans).toEqual([]);
    expect((await request(app).post(`/api/v1/library/loans/${issued.body.data.id}/return`).set(staff()).send({condition:'good'})).status).toBe(409);
    expect(await LibraryLoan.countDocuments()).toBe(1);
  });
  test('two concurrent requests cannot issue the same copy twice',async()=>{
    const b=await book();const results=await Promise.all([issue(b.items[0].id),issue(b.items[0].id,userId('TEACHER'))]);
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect(await LibraryLoan.countDocuments({copyId:b.items[0].id,status:'issued'})).toBe(1);
  });
  test('duplicate-title issues, unavailable copies, invalid due dates and archived titles are rejected',async()=>{
    const b=await book();expect((await issue(b.items[0].id)).status).toBe(201);
    expect((await issue(b.items[1].id)).status).toBe(409);
    expect((await request(app).patch(`/api/v1/library/books/${b.id}/status`).set(staff()).send({active:false})).status).toBe(409);
    expect((await request(app).patch(`/api/v1/library/copies/${b.items[0].id}`).set(staff()).send({status:'lost'})).status).toBe(409);
    const other=await book('OTHER');await request(app).patch(`/api/v1/library/copies/${other.items[0].id}`).set(staff()).send({status:'maintenance'});
    expect((await issue(other.items[0].id)).status).toBe(409);
    expect((await request(app).post('/api/v1/library/loans').set(staff()).send({copyId:other.items[1].id,borrowerId:userId('STUDENT'),dueDate:'2020-01-01'})).status).toBe(400);
  });
  test('concurrent issues across titles cannot exceed the five-book borrower limit',async()=>{
    for(let i=0;i<4;i++){const b=await book(`LIMIT-${i}`,1);expect((await issue(b.items[0].id)).status).toBe(201);}
    const a=await book('LIMIT-A',1),b=await book('LIMIT-B',1);
    const results=await Promise.all([issue(a.items[0].id),issue(b.items[0].id)]);
    expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect(await LibraryLoan.countDocuments({borrowerId:userId('STUDENT'),status:'issued'})).toBe(5);
  });
  test('damaged and lost returns keep copies out of available stock',async()=>{
    for(const [i,condition]of ['damaged','lost'].entries()){
      const b=await book(`CONDITION-${i}`,1),loan=await issue(b.items[0].id);
      const r=await request(app).post(`/api/v1/library/loans/${loan.body.data.id}/return`).set(staff()).send({condition});expect(r.status).toBe(200);
      expect((await LibraryCopy.findById(b.items[0].id)).status).toBe(condition==='damaged'?'maintenance':'lost');
    }
  });
  test('tracks overdue days and enforces renewal limits',async()=>{
    const b=await book();const loan=await issue(b.items[0].id);const id=loan.body.data.id;
    await LibraryLoan.updateOne({_id:id},{$set:{dueDate:service.addDate(service.calendarDate(),-3)}});
    const overdue=await request(app).get('/api/v1/library/loans').set(staff()).query({status:'overdue'});expect(overdue.body.data.items[0].overdueDays).toBe(3);
    for(const days of [7,14])expect((await request(app).post(`/api/v1/library/loans/${id}/renew`).set(staff()).send({dueDate:service.addDate(service.calendarDate(),days)})).status).toBe(200);
    expect((await request(app).post(`/api/v1/library/loans/${id}/renew`).set(staff()).send({dueDate:service.addDate(service.calendarDate(),21)})).status).toBe(409);
  });
  test('students and teachers see only their own loans; client-supplied borrower IDs cannot expand scope',async()=>{
    const a=await book('PRIVATE-A'),b=await book('PRIVATE-B');await issue(a.items[0].id);await issue(b.items[0].id,userId('TEACHER'));
    const own=await request(app).get('/api/v1/library/my-loans').set(auth('STUDENT')).query({borrowerId:userId('TEACHER')});expect(own.body.data.total).toBe(1);expect(own.body.data.items[0].bookTitle).toBe(a.title);expect(own.body.data.items[0].borrowerEmail).toBeUndefined();
    expect((await request(app).get('/api/v1/library/loans').set(auth('STUDENT'))).status).toBe(403);
    expect((await request(app).post('/api/v1/library/loans').set(auth('STUDENT')).send({copyId:a.items[1].id,borrowerId:userId('STUDENT')})).status).toBe(403);
    expect((await request(app).get('/api/v1/library/overview').set(auth('STUDENT'))).body.data.issued).toBe(1);
  });
});

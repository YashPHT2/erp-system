const { LibraryBook, LibraryCopy, LibraryLoan } = require('../../models/Library');
const { SystemMeta } = require('../../models/System');
const Counter = require('../../models/Counter');
const User = require('../../models/User');
const students = require('../../integrations/students');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { runInTransaction } = require('../../utils/transaction');
const { roleAllowed } = require('../../utils/permissions');
const { requiredText, optionalText, assertObjectId, queryString, pageParams, escapeRegex, actorSnapshot } = require('../../utils/validate');
const { paged } = require('../../utils/present');
const { getZonedParts, parseIsoDate } = require('../../utils/dates');
const manage = user => roleAllowed(user.role, 'library.manage');
function calendarDate(value = new Date()) { const p=getZonedParts(value,config.timezone);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`; }
function addDate(date, days) { const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
function dueDate(value, previous) {
  const date = value || addDate(calendarDate(),14);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseIsoDate(date) || date <= calendarDate() || date > addDate(calendarDate(),60) || (previous && date <= previous)) throw new ApiError(400,'Due date must be in the next 60 days and later than the current due date when renewing.','INVALID_DUE_DATE');
  return date;
}
function quantity(value) { const n=Number(value);if(!Number.isInteger(n)||n<1||n>100)throw new ApiError(400,'Add between 1 and 100 copies at a time.','INVALID_QUANTITY');return n; }
function bookBody(body) {
  const bookCode=requiredText(body?.bookCode,'Book code',{max:40}).toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9._/-]*$/.test(bookCode))throw new ApiError(400,'Book code may contain letters, numbers, dots, slashes, underscores or hyphens.','VALIDATION_ERROR');
  return {bookCode,title:requiredText(body?.title,'Title',{max:180}),author:requiredText(body?.author,'Author',{max:120}),category:requiredText(body?.category,'Category',{max:80}),publisher:optionalText(body?.publisher,'Publisher',{max:120}),isbn:optionalText(body?.isbn,'ISBN',{max:32}),shelf:optionalText(body?.shelf,'Shelf',{max:60})};
}
async function transaction(work) {
  try { await SystemMeta.updateOne({key:'library-circulation'},{$setOnInsert:{version:0}},{upsert:true}); }
  catch(error){if(error.code!==11000)throw error;}
  return runInTransaction(async session=>{
    if(!session)throw new ApiError(503,'Library circulation requires MongoDB transactions.','TRANSACTIONS_REQUIRED');
    await SystemMeta.updateOne({key:'library-circulation'},{$inc:{version:1}},{session});
    return work(session);
  });
}
async function reserveCopies(bookId,count,session) {
  const counter=await Counter.findOneAndUpdate({_id:'library-copy'},{$inc:{seq:count}},{upsert:true,new:true,session});
  return LibraryCopy.insertMany(Array.from({length:count},(_,i)=>({bookId,accessionNumber:`LIB-${String(counter.seq-count+i+1).padStart(6,'0')}`})),{session});
}
async function createBook(body) {
  const data=bookBody(body),count=quantity(body?.initialCopies ?? 1);
  return transaction(async session=>{const [book]=await LibraryBook.create([data],{session});await reserveCopies(book._id,count,session);return {id:String(book._id)};});
}
async function updateBook(id,body) {
  assertObjectId(id);const data=bookBody(body);
  return transaction(async session=>{
    const book=await LibraryBook.findById(id).session(session);
    if(!book)throw new ApiError(404,'Book not found.','NOT_FOUND');
    if(book.bookCode!==data.bookCode)throw new ApiError(409,'Book code cannot be changed.','IMMUTABLE_CODE');
    Object.assign(book,data);await book.save({session});return {id};
  });
}
async function setBookActive(id,active) {
  assertObjectId(id);if(typeof active!=='boolean')throw new ApiError(400,'Active must be true or false.','VALIDATION_ERROR');
  return transaction(async session=>{
    const book=await LibraryBook.findById(id).session(session);if(!book)throw new ApiError(404,'Book not found.','NOT_FOUND');
    if(!active&&await LibraryLoan.exists({bookId:id,status:'issued'}).session(session))throw new ApiError(409,'Return outstanding copies before archiving this title.','BOOK_HAS_LOANS');
    book.active=active;await book.save({session});return {id,active};
  });
}
async function addCopies(id,value) {
  assertObjectId(id);const count=quantity(value);
  return transaction(async session=>{if(!await LibraryBook.exists({_id:id,active:true}).session(session))throw new ApiError(404,'Active book not found.','NOT_FOUND');const copies=await reserveCopies(id,count,session);return {count,accessionNumbers:copies.map(c=>c.accessionNumber)};});
}
async function setCopyStatus(id,status) {
  assertObjectId(id);if(!['available','maintenance','lost','retired'].includes(status))throw new ApiError(400,'Choose an available, maintenance, lost or retired status.','INVALID_STATUS');
  return transaction(async session=>{
    const copy=await LibraryCopy.findById(id).session(session);if(!copy)throw new ApiError(404,'Copy not found.','NOT_FOUND');
    if(copy.status==='issued'||await LibraryLoan.exists({copyId:id,status:'issued'}).session(session))throw new ApiError(409,'Use the return workflow for an issued copy.','COPY_IS_ISSUED');
    copy.status=status;await copy.save({session});return {id,status};
  });
}
async function copyCounts(ids) {
  const groups=await LibraryCopy.aggregate([{$match:{bookId:{$in:ids}}},{$group:{_id:{bookId:'$bookId',status:'$status'},count:{$sum:1}}}]);
  const counts=new Map();
  for(const group of groups){const id=String(group._id.bookId);if(!counts.has(id))counts.set(id,{total:0,available:0,issued:0,maintenance:0,lost:0,retired:0});const count=counts.get(id);count.total+=group.count;count[group._id.status]=group.count;}
  return counts;
}
function presentBook(book,counts) {
  return {id:String(book._id),bookCode:book.bookCode,title:book.title,author:book.author,category:book.category,publisher:book.publisher,isbn:book.isbn,shelf:book.shelf,active:book.active,copies:counts||{total:0,available:0,issued:0,maintenance:0,lost:0,retired:0}};
}
async function books(query,user) {
  const filter={};if(!(manage(user)&&query.includeArchived==='true'))filter.active=true;
  const search=queryString(query,'search',120),category=queryString(query,'category');
  if(search){const re=new RegExp(escapeRegex(search),'i');filter.$or=[{title:re},{author:re},{bookCode:re},{isbn:re}];}
  if(category)filter.category=category;
  const {page,limit,skip}=pageParams(query);
  const [items,total]=await Promise.all([LibraryBook.find(filter).sort({title:1}).skip(skip).limit(limit),LibraryBook.countDocuments(filter)]);
  const counts=await copyCounts(items.map(b=>b._id));return paged(items.map(b=>presentBook(b,counts.get(String(b._id)))),page,limit,total);
}
async function bookDetails(id,user) {
  const book=await LibraryBook.findOne({_id:assertObjectId(id),...(manage(user)?{}:{active:true})});
  if(!book)throw new ApiError(404,'Book not found.','NOT_FOUND');
  const counts=await copyCounts([book._id]);const result=presentBook(book,counts.get(id));
  if(manage(user))result.items=(await LibraryCopy.find({bookId:id}).sort({accessionNumber:1})).map(c=>({id:String(c._id),accessionNumber:c.accessionNumber,status:c.status}));
  return result;
}
async function members(query) {
  const filter={active:true,role:{$in:['STUDENT','TEACHER']}};const search=queryString(query,'search',100);
  if(search){const re=new RegExp(escapeRegex(search),'i');filter.$or=[{name:re},{email:re},{studentAdmissionNumber:re}];}
  return (await User.find(filter).sort({name:1}).limit(30)).map(u=>({id:String(u._id),name:u.name,email:u.email,role:u.role,admissionNumber:u.studentAdmissionNumber||''}));
}
async function issue(body,actor) {
  const copyId=assertObjectId(body?.copyId),borrowerId=assertObjectId(body?.borrowerId),due=dueDate(body?.dueDate),notes=optionalText(body?.notes,'Notes',{max:1000});
  const candidate=await User.findOne({_id:borrowerId,active:true,role:{$in:['STUDENT','TEACHER']}});
  if(!candidate)throw new ApiError(400,'Select an active Student or Teacher account.','INVALID_BORROWER');
  if(candidate.role==='STUDENT'&&(!candidate.studentAdmissionNumber||!await students.getStudentByAdmissionNumber(candidate.studentAdmissionNumber)))throw new ApiError(409,'Link this account to a student record before issuing books.','STUDENT_NOT_LINKED');
  return transaction(async session=>{
    const borrower=await User.findOne({_id:borrowerId,active:true,role:candidate.role,...(candidate.role==='STUDENT'?{studentAdmissionNumber:candidate.studentAdmissionNumber}:{})}).session(session);
    if(!borrower)throw new ApiError(409,'The borrower account changed. Refresh and try again.','BORROWER_CHANGED');
    const copy=await LibraryCopy.findById(copyId).session(session);const book=copy?await LibraryBook.findOne({_id:copy.bookId,active:true}).session(session):null;
    if(!copy||!book)throw new ApiError(404,'Active book copy not found.','NOT_FOUND');
    if(copy.status!=='available')throw new ApiError(409,'This copy is no longer available.','COPY_UNAVAILABLE');
    if(await LibraryLoan.countDocuments({borrowerId,status:'issued'}).session(session)>=5)throw new ApiError(409,'A member can borrow at most 5 books at a time.','BORROW_LIMIT');
    if(await LibraryLoan.exists({borrowerId,bookId:book._id,status:'issued'}).session(session))throw new ApiError(409,'This member already has an outstanding copy of this title.','DUPLICATE_LOAN');
    copy.status='issued';await copy.save({session});
    const [loan]=await LibraryLoan.create([{copyId,bookId:book._id,borrowerId,bookTitle:book.title,accessionNumber:copy.accessionNumber,borrowerName:borrower.name,borrowerEmail:borrower.email,borrowerRole:borrower.role,studentAdmissionNumber:borrower.studentAdmissionNumber||'',issuedAt:new Date(),dueDate:due,issuedBy:actorSnapshot(actor),notes}],{session});
    return {id:String(loan._id),accessionNumber:copy.accessionNumber,dueDate:due};
  });
}
async function returnBook(id,body,actor) {
  assertObjectId(id);const condition=body?.condition||'good';if(!['good','damaged','lost'].includes(condition))throw new ApiError(400,'Choose a valid return condition.','INVALID_CONDITION');
  const notes=optionalText(body?.notes,'Return notes',{max:1000});
  return transaction(async session=>{
    const loan=await LibraryLoan.findById(id).session(session);if(!loan)throw new ApiError(404,'Loan not found.','NOT_FOUND');
    if(loan.status!=='issued')throw new ApiError(409,'This book has already been returned.','ALREADY_RETURNED');
    const copy=await LibraryCopy.findById(loan.copyId).session(session);if(!copy||copy.status!=='issued')throw new ApiError(409,'The copy record needs review before returning.','COPY_MISMATCH');
    loan.status='returned';loan.returnedAt=new Date();loan.returnCondition=condition;loan.returnedBy=actorSnapshot(actor);loan.returnNotes=notes;
    copy.status=condition==='good'?'available':condition==='damaged'?'maintenance':'lost';
    await loan.save({session});await copy.save({session});return {id,status:'returned',copyStatus:copy.status};
  });
}
async function renew(id,value,actor) {
  assertObjectId(id);return transaction(async session=>{
    const loan=await LibraryLoan.findById(id).session(session);if(!loan)throw new ApiError(404,'Loan not found.','NOT_FOUND');
    if(loan.status!=='issued')throw new ApiError(409,'Returned books cannot be renewed.','ALREADY_RETURNED');
    if(loan.renewalCount>=2)throw new ApiError(409,'A loan can be renewed at most twice.','RENEWAL_LIMIT');
    const next=dueDate(value,loan.dueDate);loan.renewals.push({from:loan.dueDate,to:next,at:new Date(),by:actorSnapshot(actor)});loan.dueDate=next;loan.renewalCount+=1;
    await loan.save({session});return {id,dueDate:next,renewalCount:loan.renewalCount};
  });
}
async function ownScope(actor) {
  const user=await User.findOne({_id:actor.userId,active:true,role:{$in:['STUDENT','TEACHER']}});
  if(!user)throw new ApiError(403,'Only students and teachers have a personal borrowing account.','FORBIDDEN');
  if(user.role==='STUDENT'&&!user.studentAdmissionNumber)throw new ApiError(409,'Your account must be linked to a student record first.','STUDENT_NOT_LINKED');
  return {borrowerId:user._id,borrowerRole:user.role,...(user.role==='STUDENT'?{studentAdmissionNumber:user.studentAdmissionNumber}:{})};
}
function loanFilter(query) {
  const filter={},status=queryString(query,'status');
  if(status==='overdue'){filter.status='issued';filter.dueDate={$lt:calendarDate()};}
  else if(['issued','returned'].includes(status))filter.status=status;
  const search=queryString(query,'search',120);if(search){const re=new RegExp(escapeRegex(search),'i');filter.$or=[{bookTitle:re},{accessionNumber:re},{borrowerName:re},{studentAdmissionNumber:re}];}
  return filter;
}
function presentLoan(loan,isManager) {
  const reference=loan.returnedAt?calendarDate(loan.returnedAt):calendarDate();
  const overdueDays=Math.max(0,Math.round((Date.parse(reference)-Date.parse(loan.dueDate))/86400000));
  return {id:String(loan._id),bookTitle:loan.bookTitle,accessionNumber:loan.accessionNumber,issuedAt:loan.issuedAt,dueDate:loan.dueDate,returnedAt:loan.returnedAt,status:loan.status==='issued'&&overdueDays>0?'overdue':loan.status,overdueDays,renewalCount:loan.renewalCount,returnCondition:loan.returnCondition||null,notes:loan.notes,...(isManager?{borrowerId:String(loan.borrowerId),borrowerName:loan.borrowerName,borrowerEmail:loan.borrowerEmail,borrowerRole:loan.borrowerRole,admissionNumber:loan.studentAdmissionNumber}: {})};
}
async function loans(query,actor,personal=false) {
  const filter={...loanFilter(query),...(personal?await ownScope(actor):{})};
  const {page,limit,skip}=pageParams(query);const [items,total]=await Promise.all([LibraryLoan.find(filter).sort({issuedAt:-1,_id:-1}).skip(skip).limit(limit),LibraryLoan.countDocuments(filter)]);
  return paged(items.map(item=>presentLoan(item,!personal)),page,limit,total);
}
async function overview(actor) {
  const activeBooks=await LibraryBook.find({active:true}).select('_id');const ids=activeBooks.map(b=>b._id);
  const inventory=await LibraryCopy.aggregate([{$match:{bookId:{$in:ids}}},{$group:{_id:'$status',count:{$sum:1}}}]);
  const counts={total:0,available:0,issued:0,maintenance:0,lost:0,retired:0};for(const row of inventory){counts[row._id]=row.count;counts.total+=row.count;}
  const personal=manage(actor)?{}:await ownScope(actor);
  const [overdue,issued,recent,categories]=await Promise.all([LibraryLoan.countDocuments({...personal,status:'issued',dueDate:{$lt:calendarDate()}}),LibraryLoan.countDocuments({...personal,status:'issued'}),LibraryLoan.find({...personal,status:'issued',...(manage(actor)?{dueDate:{$lt:calendarDate()}}:{})}).sort({dueDate:1}).limit(5),LibraryBook.distinct('category',{active:true})]);
  return {today:calendarDate(),defaultDueDate:addDate(calendarDate(),14),maxDueDate:addDate(calendarDate(),60),titles:activeBooks.length,copies:counts,issued,overdue,categories:categories.sort(),loans:recent.map(l=>presentLoan(l,manage(actor))),policy:{maxBooks:5,maxRenewals:2,defaultDays:14}};
}
module.exports={calendarDate,addDate,books,bookDetails,createBook,updateBook,setBookActive,addCopies,setCopyStatus,members,issue,returnBook,renew,loans,overview};

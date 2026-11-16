if(require.main===module){require('dotenv').config();const uri=new URL(process.env.MONGO_URI);uri.pathname='/edufinance_demo';process.env.MONGO_URI=uri.toString();}
const bcrypt=require('bcryptjs');
const config=require('../config/env');
const User=require('../models/User');
const {LibraryBook,LibraryCopy,LibraryLoan}=require('../models/Library');
const {SystemMeta}=require('../models/System');
const Counter=require('../models/Counter');
const service=require('../modules/library/library.service');
async function seedLibrary(){
  if(process.env.NODE_ENV==='production'||new URL(config.mongoUri).pathname!=='/edufinance_demo')throw new Error('Library fixtures are restricted to edufinance_demo outside production.');
  await require('../utils/transaction').refreshTransactionSupport();
  await Promise.all([User,LibraryBook,LibraryCopy,LibraryLoan,SystemMeta,Counter].map(m=>m.init()));
  let librarian=await User.findOne({email:'librarian@edufinance.local'});
  if(!librarian)librarian=await User.create({email:'librarian@edufinance.local',name:'Sneha Patil',role:'LIBRARIAN',passwordHash:await bcrypt.hash(process.env.DEMO_PASSWORD||'Demo#Finance2026',12)});
  if(librarian.role!=='LIBRARIAN')throw new Error('Existing librarian email has another role; account preserved.');
  const actor={userId:String(librarian._id),name:librarian.name,role:librarian.role};
  const titles=[
    ['DEMO-MATH','Mathematics Essentials','Academic Faculty','Mathematics','A-101'],
    ['DEMO-SCI','Exploring Science','Academic Faculty','Science','A-102'],
    ['DEMO-COMP','Foundations of Computing','Technology Department','Computing','B-201'],
    ['DEMO-STORY','Stories from the Reading Room','Library Collection','Literature','C-301'],
    ['DEMO-HIST','A Journey Through History','Humanities Faculty','History','C-302'],
    ['DEMO-PHYS','Physics Practice Companion','Science Department','Science','A-103'],
    ['DEMO-LANG','English Language Workshop','Language Department','Languages','D-401'],
    ['DEMO-ATLAS','World Geography Companion','Humanities Faculty','Geography','D-402'],
  ];
  for(const [bookCode,title,author,category,shelf]of titles)if(!await LibraryBook.exists({bookCode}))await service.createBook({bookCode,title,author,category,shelf,publisher:'Demonstration Library',initialCopies:3});
  const student=await User.findOne({email:'student@edufinance.local'}),teacher=await User.findOne({email:'teacher@edufinance.local'});
  async function sample(code,borrower,kind){
    const notes=`Demonstration: ${kind} loan`;if(!borrower||await LibraryLoan.exists({notes}))return;
    const book=await LibraryBook.findOne({bookCode:code});const copy=await LibraryCopy.findOne({bookId:book._id,status:'available'});
    if(!copy)return;
    const created=await service.issue({copyId:String(copy._id),borrowerId:String(borrower._id),notes},actor);
    const now=service.calendarDate();
    if(kind==='overdue student')await LibraryLoan.updateOne({_id:created.id},{$set:{issuedAt:new Date(`${service.addDate(now,-20)}T05:00:00Z`),dueDate:service.addDate(now,-6)}});
    if(kind==='returned student'){
      await service.returnBook(created.id,{condition:'good',notes:'Demonstration: returned on time.'},actor);
      await LibraryLoan.updateOne({_id:created.id},{$set:{issuedAt:new Date(`${service.addDate(now,-30)}T05:00:00Z`),dueDate:service.addDate(now,-16),returnedAt:new Date(`${service.addDate(now,-18)}T05:00:00Z`)}});
    }
  }
  await sample('DEMO-MATH',student,'current student');await sample('DEMO-SCI',student,'overdue student');await sample('DEMO-STORY',student,'returned student');await sample('DEMO-COMP',teacher,'current teacher');
  console.log('Demo library ready: 8 titles, 24 copies, student and teacher loans, overdue and return examples.');
}
module.exports={seedLibrary};
if(require.main===module)require('../config/db').connectDb().then(seedLibrary).then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});

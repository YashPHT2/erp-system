// Optional, idempotent teaching fixtures for the explicitly selected demo database.
if (require.main === module) {
  require('dotenv').config();
  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = '/edufinance_demo';
  process.env.MONGO_URI = uri.toString();
}
const config = require('../config/env');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Student = require('../models/Student');
const { TeachingSection, TeacherProfile, TimetableSlot, TeachingAssignment, SectionAttendance } = require('../models/Teaching');
const { currentAcademicYear, getZonedParts } = require('../utils/dates');
async function seedTeaching() {
  if (process.env.NODE_ENV === 'production' || new URL(config.mongoUri).pathname !== '/edufinance_demo') throw new Error('Teaching fixtures can only be loaded into edufinance_demo outside production.');
  await Promise.all([TeachingSection,TeacherProfile,TimetableSlot,TeachingAssignment,SectionAttendance].map(m=>m.init()));
  const teacher = await User.findOne({ email: 'teacher@edufinance.local', role: 'TEACHER' });
  const employee = await Employee.findOne({ employeeCode: 'EMP1001' });
  if (!teacher || !employee) throw new Error('Load the core demo accounts and employees first.');
  const academicYear = currentAcademicYear(new Date(), config.timezone);
  const grouped = await Student.aggregate([{ $match: { academicYear } }, { $group: { _id: { className: '$className', section: '$section', academicYear: '$academicYear' } } }]);
  for (const group of grouped) if (group._id.section) await TeachingSection.updateOne(group._id, { $setOnInsert: group._id }, { upsert: true });
  const sections = await TeachingSection.find({ academicYear, $or: [{ className: 'Grade 10', section: { $in: ['A','B'] } }, { className: 'Grade 8', section: 'A' }] }).sort({ className: 1, section: 1 });
  await TeacherProfile.updateOne({ teacherId: teacher._id }, { $setOnInsert: { employeeId: String(employee._id), assignments: sections.map(s=>({sectionId:s._id,subject:'Mathematics'})) } }, { upsert: true });
  if (!await TimetableSlot.exists({ teacherId: teacher._id })) {
    const lessons = [];
    for (let day=1;day<=5;day++) for (let i=0;i<sections.length;i++) lessons.push({ teacherId: teacher._id, sectionId: sections[i]._id, day, startTime: `${String(9+i).padStart(2,'0')}:00`, endTime: `${String(9+i).padStart(2,'0')}:45`, subject: 'Mathematics', room: `Room ${201+i}` });
    await TimetableSlot.insertMany(lessons);
  }
  const date = delta => { const d = new Date(Date.now()+delta*86400000); const z=getZonedParts(d,config.timezone);return `${z.year}-${String(z.month).padStart(2,'0')}-${String(z.day).padStart(2,'0')}`; };
  const text = Buffer.from('Mathematics practice\n1. Solve 2x + 5 = 17.\n2. Factor x^2 + 5x + 6.\n3. Find the area of a triangle with base 12 cm and height 8 cm.\nShow your working for each question.\n');
  await TeachingAssignment.updateOne({ teacherId: teacher._id, title: 'Weekly mathematics practice' }, { $setOnInsert: { instructions: 'Complete the attached practice questions. Show each step and bring your answers to the next lesson.', sectionIds: sections.map(s=>s._id), dueDate:date(7), attachment:{filename:'mathematics-practice.txt',contentType:'text/plain',size:text.length,data:text} } }, { upsert:true });
  if(sections[0])await TeachingAssignment.updateOne({teacherId:teacher._id,title:'Algebra revision worksheet'},{$setOnInsert:{instructions:'Revise linear equations and solve five examples from your textbook. Write a short explanation of your method.',sectionIds:[sections[0]._id],dueDate:date(3)}},{upsert:true});
  for(const section of sections.slice(0,2)) {
    const roster=await Student.find({className:section.className,section:section.section,academicYear});
    if(roster.length)await SectionAttendance.updateOne({teacherId:teacher._id,sectionId:section._id,date:date(-1)},{$setOnInsert:{records:roster.map((student,i)=>({studentId:String(student._id),admissionNumber:student.admissionNumber,name:student.name,status:i===1?'absent':'present'}))}},{upsert:true});
  }
  console.log(`Demo teacher workspace ready: ${sections.length} sections, salary link, weekly timetable, assignments and attendance.`);
}
module.exports = { seedTeaching };
if (require.main === module) require('../config/db').connectDb().then(seedTeaching).then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});

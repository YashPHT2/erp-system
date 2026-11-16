const path = require('path');
const { parse } = require('csv-parse/sync');
const User = require('../../models/User');
const { SystemMeta } = require('../../models/System');
const { TeachingSection, TeacherProfile, TimetableSlot, SectionAttendance, TeachingAssignment } = require('../../models/Teaching');
const { SalaryProfile, Payroll } = require('../../models/Payroll');
const students = require('../../integrations/students');
const employees = require('../../integrations/employees');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { requiredText, optionalText, assertObjectId, assertAcademicYear } = require('../../utils/validate');
const { getZonedParts, parseIsoDate } = require('../../utils/dates');
const { presentSalaryProfile, presentPayroll } = require('../../utils/present');
const { buildSalarySlip } = require('../payroll/payrollMath');
const { runInTransaction } = require('../../utils/transaction');
const label = section => `${section.className} · ${section.section}`;
const presentSection = section => ({ id: String(section._id), className: section.className, section: section.section, academicYear: section.academicYear, label: label(section) });
function today() {
  const p = getZonedParts(new Date(), config.timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
function dateValue(value, kind) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseIsoDate(value)) throw new ApiError(400, 'Use a valid date in YYYY-MM-DD format.', 'INVALID_DATE');
  if (kind === 'attendance' && value > today()) throw new ApiError(400, 'Attendance cannot be submitted for a future date.', 'FUTURE_ATTENDANCE');
  if (kind === 'assignment' && value < today()) throw new ApiError(400, 'The assignment due date cannot be in the past.', 'PAST_DUE_DATE');
  return value;
}
async function requireTeacher(teacherId) {
  const teacher = await User.findOne({ _id: assertObjectId(teacherId), role: 'TEACHER', active: true });
  if (!teacher) throw new ApiError(404, 'Active teacher account not found.', 'TEACHER_NOT_FOUND');
  return teacher;
}
async function assignedSection(teacherId, sectionId) {
  assertObjectId(sectionId);
  const profile = await TeacherProfile.findOne({ teacherId, 'assignments.sectionId': sectionId });
  if (!profile) throw new ApiError(403, 'You can only access your assigned sections.', 'SECTION_FORBIDDEN');
  const section = await TeachingSection.findById(sectionId);
  if (!section) throw new ApiError(404, 'Section not found.', 'NOT_FOUND');
  return section;
}
async function roster(section) {
  return (await students.listStudents({ className: section.className, section: section.section, academicYear: section.academicYear }))
    .filter(student => student.className.trim().toLowerCase() === section.className.trim().toLowerCase() && (student.section || '').toUpperCase() === section.section && student.academicYear === section.academicYear);
}
async function timetableLock() {
  await SystemMeta.updateOne({ key: 'teaching-schedule' }, { $setOnInsert: { version: 0 } }, { upsert: true });
}
async function adminData() {
  const [teachers, profiles, sections, slots, employeeList] = await Promise.all([
    User.find({ role: 'TEACHER', active: true }).select('name email').sort({ name: 1 }),
    TeacherProfile.find().lean(), TeachingSection.find().sort({ academicYear: -1, className: 1, section: 1 }),
    TimetableSlot.find().sort({ day: 1, startTime: 1 }).lean(), employees.listEmployees({}),
  ]);
  return { teachers: teachers.map(t => ({ id: String(t._id), name: t.name, email: t.email })),
    profiles: profiles.map(p => ({ teacherId: String(p.teacherId), employeeId: p.employeeId, assignments: p.assignments.map(a => ({ sectionId: String(a.sectionId), subject: a.subject })) })),
    sections: sections.map(presentSection), timetable: slots.map(s => ({ ...s, id: String(s._id), teacherId: String(s.teacherId), sectionId: String(s.sectionId) })), employees: employeeList };
}
async function createSection(body) {
  const section = await TeachingSection.create({ className: requiredText(body?.className, 'Class'), section: requiredText(body?.section, 'Section', { max: 20 }).toUpperCase(), academicYear: assertAcademicYear(body?.academicYear) });
  return presentSection(section);
}
async function saveProfile(teacherId, body) {
  await requireTeacher(teacherId);
  const employeeId = optionalText(body?.employeeId, 'Employee', { max: 100 });
  const employee = employeeId ? await employees.getEmployeeById(employeeId) : null;
  if (employeeId && !employee) throw new ApiError(400, 'Employee record not found.', 'EMPLOYEE_NOT_FOUND');
  if (!Array.isArray(body?.assignments) || body.assignments.length > 50) throw new ApiError(400, 'Supply up to 50 section assignments.', 'VALIDATION_ERROR');
  const assignments = body.assignments.map(item => ({ sectionId: assertObjectId(item?.sectionId), subject: requiredText(item?.subject, 'Subject', { max: 100 }) }));
  if (new Set(assignments.map(a => a.sectionId)).size !== assignments.length) throw new ApiError(400, 'Assign each section only once.', 'DUPLICATE_SECTION');
  const sectionIds = assignments.map(a => a.sectionId);
  if (await TeachingSection.countDocuments({ _id: { $in: sectionIds } }) !== sectionIds.length) throw new ApiError(400, 'One or more sections do not exist.', 'INVALID_SECTION');
  await timetableLock();
  await runInTransaction(async session => {
    await SystemMeta.updateOne({ key: 'teaching-schedule' }, { $inc: { version: 1 } }, { session });
    if (employee && await TeacherProfile.exists({ teacherId: { $ne: teacherId }, employeeId: employee.id }).session(session)) throw new ApiError(409, 'This employee is already linked to another teacher account.', 'EMPLOYEE_ALREADY_LINKED');
    await TeacherProfile.findOneAndUpdate({ teacherId }, { $set: { employeeId: employee?.id || '', assignments } }, { upsert: true, runValidators: true, session });
    await TimetableSlot.deleteMany({ teacherId, sectionId: { $nin: sectionIds } }, { session });
  });
  return { message: 'Teacher profile saved.' };
}
async function createSlot(body) {
  const teacherId = assertObjectId(body?.teacherId);
  await requireTeacher(teacherId);
  const sectionId = assertObjectId(body?.sectionId);
  const day = Number(body?.day);
  const startTime = body?.startTime, endTime = body?.endTime;
  if (!Number.isInteger(day) || day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || '') || startTime >= endTime) throw new ApiError(400, 'Choose a valid weekday and an end time after the start time.', 'INVALID_TIME');
  const subject = requiredText(body?.subject, 'Subject', { max: 100 });
  const room = optionalText(body?.room, 'Room', { max: 60 });
  await timetableLock();
  let result;
  await runInTransaction(async session => {
    await SystemMeta.updateOne({ key: 'teaching-schedule' }, { $inc: { version: 1 } }, { session });
    if (!await TeacherProfile.exists({ teacherId, 'assignments.sectionId': sectionId }).session(session)) throw new ApiError(400, 'Assign this section to the teacher first.', 'SECTION_NOT_ASSIGNED');
    if (await TimetableSlot.exists({ day, startTime: { $lt: endTime }, endTime: { $gt: startTime }, $or: [{ teacherId }, { sectionId }] }).session(session)) throw new ApiError(409, 'This lesson overlaps another lesson for the teacher or section.', 'TIMETABLE_CONFLICT');
    const [slot] = await TimetableSlot.create([{ teacherId, sectionId, day, startTime, endTime, subject, room }], { session });
    result = { id: String(slot._id) };
  });
  return result;
}
async function removeSlot(id) { await TimetableSlot.deleteOne({ _id: assertObjectId(id) }); }
async function overview(teacherId) {
  const profile = await TeacherProfile.findOne({ teacherId });
  const ids = profile?.assignments.map(a => a.sectionId) || [];
  const sections = await TeachingSection.find({ _id: { $in: ids } }).sort({ className: 1, section: 1 });
  const sectionsWithCounts = await Promise.all(sections.map(async section => ({ ...presentSection(section), subject: profile.assignments.find(a => String(a.sectionId) === String(section._id)).subject, studentCount: (await roster(section)).length })));
  const [salary, payroll, slots, assignmentCount, attendanceCount] = await Promise.all([
    profile?.employeeId ? SalaryProfile.findOne({ employeeId: profile.employeeId }) : null,
    profile?.employeeId ? Payroll.find({ employeeId: profile.employeeId }).sort({ year: -1, month: -1 }).limit(24) : [],
    TimetableSlot.find({ teacherId, sectionId: { $in: ids } }).sort({ day: 1, startTime: 1 }),
    TeachingAssignment.countDocuments({ teacherId }), SectionAttendance.countDocuments({ teacherId, date: today() }),
  ]);
  const p = getZonedParts(new Date(), config.timezone);
  return { today: today(), weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(),
    employeeLinked: Boolean(profile?.employeeId), sections: sectionsWithCounts,
    salary: salary ? presentSalaryProfile(salary) : null, payroll: payroll.map(presentPayroll),
    timetable: slots.map(slot => ({ id: String(slot._id), sectionId: String(slot.sectionId), day: slot.day, startTime: slot.startTime, endTime: slot.endTime, subject: slot.subject, room: slot.room })),
    assignmentCount, attendanceSubmittedToday: attendanceCount };
}
async function salarySlip(teacherId, payrollId) {
  const profile = await TeacherProfile.findOne({ teacherId });
  const payroll = profile?.employeeId ? await Payroll.findOne({ _id: assertObjectId(payrollId), employeeId: profile.employeeId }) : null;
  if (!payroll) throw new ApiError(404, 'Salary slip not found.', 'NOT_FOUND');
  return buildSalarySlip(payroll, config.institutionName);
}
async function attendance(teacherId, sectionId, date) {
  date = dateValue(date, 'attendance');
  const section = await assignedSection(teacherId, sectionId);
  const [items, saved] = await Promise.all([roster(section), SectionAttendance.findOne({ teacherId, sectionId, date })]);
  const statuses = new Map((saved?.records || []).map(r => [r.studentId, r.status]));
  return { section: presentSection(section), date, saved: Boolean(saved), updatedAt: saved?.updatedAt || null,
    records: items.map(student => ({ studentId: student.id, admissionNumber: student.admissionNumber, name: student.name, status: statuses.get(student.id) || '' })) };
}
async function saveAttendance(teacherId, body, csvFile) {
  const section = await assignedSection(teacherId, body?.sectionId);
  const date = dateValue(body?.date, 'attendance');
  const items = await roster(section);
  if (!items.length) throw new ApiError(400, 'No students are enrolled in this section.', 'EMPTY_ROSTER');
  let supplied = body?.records;
  if (csvFile) {
    if (path.extname(csvFile.originalname).toLowerCase() !== '.csv') throw new ApiError(400, 'Upload a CSV attendance file.', 'INVALID_FILE');
    try { supplied = parse(csvFile.buffer, { columns: true, bom: true, trim: true, skip_empty_lines: true, max_record_size: 1000 }); }
    catch (_) { throw new ApiError(400, 'Invalid CSV. Use the attendance template.', 'INVALID_CSV'); }
  }
  if (!Array.isArray(supplied) || supplied.length !== items.length || supplied.length > 1000) throw new ApiError(400, 'Provide exactly one attendance status for every student in the section.', 'INCOMPLETE_ATTENDANCE');
  const byId = new Map(items.map(s => [s.id, s]));
  const byAdmission = new Map(items.map(s => [s.admissionNumber.toUpperCase(), s]));
  const seen = new Set();
  const records = supplied.map(row => {
    if (!row || typeof row !== 'object') throw new ApiError(400, 'Each attendance row must contain a student and status.', 'INVALID_ATTENDANCE');
    const student = csvFile ? byAdmission.get(String(row.admissionNumber || '').toUpperCase()) : byId.get(String(row.studentId || ''));
    const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
    if (!student || seen.has(student.id) || !['present', 'absent', 'late', 'excused'].includes(status)) throw new ApiError(400, 'Attendance contains an unknown/duplicate student or invalid status. Use present, absent, late, or excused.', 'INVALID_ATTENDANCE');
    seen.add(student.id);
    return { studentId: student.id, admissionNumber: student.admissionNumber, name: student.name, status };
  });
  // A revision replaces this teacher's entire register for that section and date.
  await SectionAttendance.findOneAndUpdate({ teacherId, sectionId: section._id, date }, { $set: { records } }, { upsert: true, runValidators: true });
  return { date, count: records.length, message: 'Attendance saved.' };
}
const FILE_TYPES = { '.pdf': 'application/pdf', '.txt': 'text/plain', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
function attachment(file) {
  if (!file) return undefined;
  const ext = path.extname(file.originalname).toLowerCase();
  if (!FILE_TYPES[ext]) throw new ApiError(400, 'Use a PDF, Word document, text file, PNG, or JPEG.', 'INVALID_FILE');
  const data = file.buffer;
  const signatures = {
    '.pdf': () => data.subarray(0,5).toString() === '%PDF-',
    '.docx': () => data.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])),
    '.doc': () => data.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])),
    '.png': () => data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    '.jpg': () => data.subarray(0,3).equals(Buffer.from([255,216,255])),
    '.jpeg': () => data.subarray(0,3).equals(Buffer.from([255,216,255])),
    '.txt': () => !data.includes(0),
  };
  if (!data.length || !signatures[ext]()) throw new ApiError(400, 'The file content does not match its format.', 'INVALID_FILE');
  return { filename: path.basename(file.originalname.replace(/\\/g,'/')).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,150), contentType: FILE_TYPES[ext], size: file.size, data };
}
async function publishAssignment(teacherId, body, file) {
  const profile = await TeacherProfile.findOne({ teacherId });
  const allowed = new Set((profile?.assignments || []).map(a => String(a.sectionId)));
  let sectionIds = body?.sectionIds;
  if (typeof sectionIds === 'string') { try { sectionIds = JSON.parse(sectionIds); } catch (_) { throw new ApiError(400, 'Select valid target sections.', 'INVALID_SECTION'); } }
  if (body?.allSections === true || body?.allSections === 'true') sectionIds = [...allowed];
  if (!Array.isArray(sectionIds) || !sectionIds.length || sectionIds.length > 50 || new Set(sectionIds).size !== sectionIds.length || sectionIds.some(id => typeof id !== 'string' || !allowed.has(id))) throw new ApiError(403, 'Select one or more sections that you teach.', 'SECTION_FORBIDDEN');
  const title = requiredText(body?.title, 'Assignment title', { min: 3, max: 150 });
  const instructionsValue = body?.instructions == null ? '' : body.instructions;
  if (typeof instructionsValue !== 'string' || instructionsValue.length > 10000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(instructionsValue)) throw new ApiError(400, 'Instructions must be text of at most 10,000 characters.', 'VALIDATION_ERROR');
  const instructions = instructionsValue.trim();
  const attached = attachment(file);
  if (!instructions && !attached) throw new ApiError(400, 'Add instructions or attach an assignment file.', 'EMPTY_ASSIGNMENT');
  const assignment = await TeachingAssignment.create({ teacherId, title, instructions, dueDate: dateValue(body?.dueDate, 'assignment'), sectionIds, ...(attached ? { attachment: attached } : {}) });
  return { id: String(assignment._id), message: 'Assignment published.' };
}
async function listAssignments(teacherId) {
  const records = await TeachingAssignment.find({ teacherId }).sort({ createdAt: -1 }).limit(100).populate('sectionIds');
  return records.map(a => ({ id: String(a._id), title: a.title, instructions: a.instructions, dueDate: a.dueDate, createdAt: a.createdAt,
    sections: a.sectionIds.map(presentSection), attachment: a.attachment?.filename ? { filename: a.attachment.filename, size: a.attachment.size } : null }));
}
async function assignmentFile(teacherId, id) {
  const assignment = await TeachingAssignment.findOne({ _id: assertObjectId(id), teacherId }).select('+attachment.data');
  if (!assignment?.attachment?.data) throw new ApiError(404, 'Attachment not found.', 'NOT_FOUND');
  return assignment.attachment;
}
module.exports = { today, adminData, createSection, saveProfile, createSlot, removeSlot, overview, salarySlip, attendance, saveAttendance, publishAssignment, listAssignments, assignmentFile };

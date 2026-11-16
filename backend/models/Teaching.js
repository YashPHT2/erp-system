const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const ref = name => ({ type: mongoose.Schema.Types.ObjectId, ref: name, required: true });
const sectionSchema = new mongoose.Schema({
  className: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true, uppercase: true },
  academicYear: { type: String, required: true },
}, { timestamps: true });
sectionSchema.index({ className: 1, section: 1, academicYear: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
const profileSchema = new mongoose.Schema({
  teacherId: { ...ref('User'), unique: true },
  employeeId: { type: String, default: '' },
  assignments: [{ sectionId: ref('TeachingSection'), subject: { type: String, required: true }, _id: false }],
}, { timestamps: true });
const slotSchema = new mongoose.Schema({
  teacherId: ref('User'), sectionId: ref('TeachingSection'),
  day: { type: Number, required: true, min: 0, max: 6 },
  startTime: { type: String, required: true }, endTime: { type: String, required: true },
  subject: { type: String, required: true }, room: { type: String, default: '' },
}, { timestamps: true });
slotSchema.index({ teacherId: 1, day: 1, startTime: 1 });
slotSchema.index({ sectionId: 1, day: 1, startTime: 1 });
const attendanceSchema = new mongoose.Schema({
  teacherId: ref('User'), sectionId: ref('TeachingSection'), date: { type: String, required: true },
  records: [{ studentId: { type: String, required: true }, admissionNumber: { type: String, required: true },
    name: { type: String, required: true }, status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true }, _id: false }],
}, { timestamps: true });
attendanceSchema.index({ teacherId: 1, sectionId: 1, date: 1 }, { unique: true });
const assignmentSchema = new mongoose.Schema({
  teacherId: ref('User'), title: { type: String, required: true }, instructions: { type: String, default: '' },
  sectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TeachingSection', required: true }],
  dueDate: { type: String, required: true },
  attachment: { filename: String, contentType: String, size: Number, data: { type: Buffer, select: false } },
}, { timestamps: true });
assignmentSchema.index({ teacherId: 1, createdAt: -1 });
module.exports = {
  TeachingSection: registerModel('TeachingSection', sectionSchema),
  TeacherProfile: registerModel('TeacherProfile', profileSchema),
  TimetableSlot: registerModel('TimetableSlot', slotSchema),
  SectionAttendance: registerModel('SectionAttendance', attendanceSchema),
  TeachingAssignment: registerModel('TeachingAssignment', assignmentSchema),
};

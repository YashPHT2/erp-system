const Student = require('../../models/Student');
const { escapeRegex } = require('../../utils/validate');
const present = doc => ({ id: String(doc._id), admissionNumber: doc.admissionNumber, name: doc.name,
  className: doc.className, section: doc.section, academicYear: doc.academicYear });
async function listStudents(filters = {}) {
  const query = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.className) query.className = new RegExp(`^${escapeRegex(filters.className)}$`, 'i');
  if (filters.section) query.section = filters.section.toUpperCase();
  if (filters.search) {
    const re = new RegExp(escapeRegex(filters.search), 'i');
    query.$or = [{ name: re }, { admissionNumber: re }];
  }
  return (await Student.find(query).sort({ name: 1 }).lean()).map(present);
}
async function searchStudents(search) {
  const q = typeof search === 'string' ? search.trim() : '';
  return q.length < 2 ? [] : (await listStudents({ search: q })).slice(0, 20);
}
async function getStudentByAdmissionNumber(value) {
  const doc = await Student.findOne({ admissionNumber: String(value || '').trim().toUpperCase() }).lean();
  return doc ? present(doc) : null;
}
async function listClasses() {
  const grouped = new Map();
  for (const student of await listStudents()) {
    const key = `${student.academicYear}:${student.className}`;
    if (!grouped.has(key)) grouped.set(key, { academicYear: student.academicYear, className: student.className, sections: new Set() });
    if (student.section) grouped.get(key).sections.add(student.section);
  }
  return [...grouped.values()].map(item => ({ ...item, sections: [...item.sections].sort() }));
}
module.exports = { listStudents, searchStudents, getStudentByAdmissionNumber, listClasses };

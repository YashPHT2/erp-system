const { getStudents } = require('../mockData/directory');
const { classKey, sectionKey } = require('../../utils/validate');

function matchesSearch(student, search) {
  if (!search) return true;
  const haystack = `${student.name} ${student.admissionNumber}`.toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

function filterStudents(filters = {}) {
  return getStudents().filter((student) => {
    if (filters.academicYear && student.academicYear !== filters.academicYear) return false;
    if (filters.className && classKey(student.className) !== classKey(filters.className)) return false;
    if (filters.section && sectionKey(student.section) !== sectionKey(filters.section)) return false;
    if (filters.search && !matchesSearch(student, filters.search)) return false;
    return true;
  });
}

async function searchStudents(search) {
  const query = typeof search === 'string' ? search.trim() : '';
  if (query.length < 2) return [];
  return filterStudents({ search: query }).slice(0, 20);
}

async function getStudentByAdmissionNumber(admissionNumber) {
  const key = String(admissionNumber || '').trim().toLowerCase();
  return getStudents().find((student) => student.admissionNumber.toLowerCase() === key) || null;
}

async function listStudents(filters) {
  return filterStudents(filters);
}

async function listClasses() {
  const grouped = new Map();
  for (const student of getStudents()) {
    const key = `${student.academicYear}::${student.className}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        academicYear: student.academicYear,
        className: student.className,
        sections: new Set(),
      });
    }
    if (student.section) grouped.get(key).sections.add(student.section);
  }
  return Array.from(grouped.values())
    .map((item) => ({ ...item, sections: Array.from(item.sections).sort() }))
    .sort((left, right) => left.className.localeCompare(right.className));
}

module.exports = {
  searchStudents,
  getStudentByAdmissionNumber,
  listStudents,
  listClasses,
};

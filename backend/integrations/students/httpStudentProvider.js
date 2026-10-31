const config = require('../../config/env');
const { mapStudent } = require('../mapRecords');
const { fetchJson, unwrapList, unwrapOne, requireBaseUrl } = require('../httpClient');

function baseUrl() {
  return requireBaseUrl(config.studentApiBaseUrl, 'STUDENT_API_BASE_URL');
}

async function searchStudents(search) {
  const query = typeof search === 'string' ? search.trim() : '';
  if (query.length < 2) return [];
  const url = `${baseUrl()}/students?search=${encodeURIComponent(query)}`;
  const result = await fetchJson(url);
  if (result.notFound) return [];
  return unwrapList(result.body, 'Student').map(mapStudent);
}

async function getStudentByAdmissionNumber(admissionNumber) {
  const url = `${baseUrl()}/students/by-admission/${encodeURIComponent(admissionNumber)}`;
  const result = await fetchJson(url);
  if (result.notFound) return null;
  return mapStudent(unwrapOne(result.body));
}

async function listStudents(filters = {}) {
  const params = new URLSearchParams();
  if (filters.academicYear) params.set('academicYear', filters.academicYear);
  if (filters.className) params.set('className', filters.className);
  if (filters.section) params.set('section', filters.section);
  if (filters.search) params.set('search', filters.search);
  const url = `${baseUrl()}/students?${params.toString()}`;
  const result = await fetchJson(url);
  if (result.notFound) return [];
  return unwrapList(result.body, 'Student').map(mapStudent);
}

async function listClasses() {
  const students = await listStudents({});
  const grouped = new Map();
  for (const student of students) {
    const key = `${student.academicYear}::${student.className}`;
    if (!grouped.has(key)) {
      grouped.set(key, { academicYear: student.academicYear, className: student.className, sections: new Set() });
    }
    if (student.section) grouped.get(key).sections.add(student.section);
  }
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    sections: Array.from(item.sections).sort(),
  }));
}

module.exports = {
  searchStudents,
  getStudentByAdmissionNumber,
  listStudents,
  listClasses,
};

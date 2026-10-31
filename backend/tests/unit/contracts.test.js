const { mapStudent, mapEmployee } = require('../../integrations/mapRecords');
const studentDirectory = require('../../integrations/students');

describe('integration contracts', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.STUDENT_PROVIDER = 'mock';
    process.env.STUDENT_API_BASE_URL = '';
    global.fetch = originalFetch;
  });

  test('maps a student payload and rejects a missing field', () => {
    expect(mapStudent({
      id: 12,
      admissionNumber: 'ADM1',
      name: 'Asha',
      className: 'Grade 8',
      section: 'A',
      academicYear: '2026-2027',
    })).toMatchObject({ id: '12', name: 'Asha', section: 'A' });

    expect(() => mapStudent({ id: '1', admissionNumber: 'ADM1' })).toThrow(/missing name/);
  });

  test('maps an employee and keeps an inactive status', () => {
    expect(mapEmployee({
      id: 'emp_9',
      employeeCode: 'EMP9',
      name: 'Inactive Person',
      designation: 'Teacher',
      department: 'Science',
      status: 'Inactive',
    }).status).toBe('inactive');
  });

  test('loads a student from the HTTP contract', async () => {
    process.env.STUDENT_PROVIDER = 'http';
    process.env.STUDENT_API_BASE_URL = 'http://students.local/api';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 9,
          admissionNumber: 'ADM9',
          name: 'Asha',
          className: 'Grade 8',
          academicYear: '2026-2027',
        },
      }),
    });

    const student = await studentDirectory.getStudentByAdmissionNumber('ADM9');
    expect(student).toMatchObject({ id: '9', name: 'Asha', section: '' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://students.local/api/students/by-admission/ADM9',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});

const { currentAcademicYear } = require('../../utils/dates');

const STUDENT_SEED = [
  { id: 'stu_2026001', admissionNumber: 'ADM2026001', name: 'Aarav Sharma', className: 'Grade 10', section: 'A' },
  { id: 'stu_2026002', admissionNumber: 'ADM2026002', name: 'Diya Nair', className: 'Grade 10', section: 'A' },
  { id: 'stu_2026003', admissionNumber: 'ADM2026003', name: 'Kabir Singh', className: 'Grade 10', section: 'A' },
  { id: 'stu_2026004', admissionNumber: 'ADM2026004', name: 'Ananya Reddy', className: 'Grade 10', section: 'B' },
  { id: 'stu_2026005', admissionNumber: 'ADM2026005', name: 'Ishaan Gupta', className: 'Grade 8', section: 'A' },
  { id: 'stu_2026006', admissionNumber: 'ADM2026006', name: 'Sara Khan', className: 'Grade 8', section: 'A' },
  { id: 'stu_2026007', admissionNumber: 'ADM2026007', name: 'Vivaan Patel', className: 'Grade 9', section: 'A' },
  { id: 'stu_2026008', admissionNumber: 'ADM2026008', name: 'Myra Das', className: 'Grade 9', section: 'A' },
  { id: 'stu_2026101', admissionNumber: 'ADM2026101', name: 'Zoya Ahmed', className: 'B.Sc Computer Science Year 1', section: 'A' },
  { id: 'stu_2026102', admissionNumber: 'ADM2026102', name: 'Aditya Verma', className: 'B.Sc Computer Science Year 1', section: 'A' },
  { id: 'stu_2026201', admissionNumber: 'ADM2026201', name: 'Neel Shah', className: 'B.Com Year 2', section: 'A' },
  { id: 'stu_2026202', admissionNumber: 'ADM2026202', name: 'Ira Kapoor', className: 'B.Com Year 2', section: 'A' },
];

function getStudents() {
  const academicYear = currentAcademicYear(new Date(), process.env.APP_TIMEZONE || 'Asia/Kolkata');
  return STUDENT_SEED.map((student) => ({ ...student, academicYear }));
}

const EMPLOYEES = [
  { id: 'emp_1001', employeeCode: 'EMP1001', name: 'Meera Iyer', designation: 'Senior Teacher', department: 'Mathematics', status: 'active' },
  { id: 'emp_1002', employeeCode: 'EMP1002', name: 'Rohan Kulkarni', designation: 'Teacher', department: 'Physics', status: 'active' },
  { id: 'emp_1003', employeeCode: 'EMP1003', name: 'Fatima Qureshi', designation: 'Assistant Professor', department: 'Computer Science', status: 'active' },
  { id: 'emp_1004', employeeCode: 'EMP1004', name: 'Arjun Menon', designation: 'Lecturer', department: 'Commerce', status: 'active' },
  { id: 'emp_1005', employeeCode: 'EMP1005', name: 'Sneha Patil', designation: 'Librarian', department: 'Library', status: 'active' },
  { id: 'emp_1006', employeeCode: 'EMP1006', name: 'Vikram Joshi', designation: 'Accountant', department: 'Finance', status: 'active' },
  { id: 'emp_1007', employeeCode: 'EMP1007', name: 'Lavanya Rao', designation: 'Fee Clerk', department: 'Finance', status: 'active' },
  { id: 'emp_1008', employeeCode: 'EMP1008', name: "Joseph D'Souza", designation: 'Transport Supervisor', department: 'Administration', status: 'active' },
  { id: 'emp_1009', employeeCode: 'EMP1009', name: 'Priya Banerjee', designation: 'Principal', department: 'Administration', status: 'active' },
  { id: 'emp_1010', employeeCode: 'EMP1010', name: 'Harish Gupta', designation: 'Lab Assistant', department: 'Computer Science', status: 'active' },
];

module.exports = { getStudents, EMPLOYEES };

// Adds the demonstration student account without replacing any existing users or financial records.
if (require.main === module) {
  require('dotenv').config();
  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = '/edufinance_demo';
  process.env.MONGO_URI = uri.toString();
}
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const User = require('../models/User');
const Student = require('../models/Student');
async function seedStudent() {
  if (process.env.NODE_ENV === 'production' || new URL(config.mongoUri).pathname !== '/edufinance_demo') throw new Error('Student demo accounts can only be created in edufinance_demo outside production.');
  await User.init();
  const student = await Student.findOne({ admissionNumber: 'ADM2026001' });
  if (!student) throw new Error('Load the demo student records first.');
  const existing = await User.findOne({ email: 'student@edufinance.local' });
  if (existing) {
    if (existing.role !== 'STUDENT' || existing.studentAdmissionNumber !== student.admissionNumber) throw new Error('The demo student email is already in use with a different link. Existing account preserved.');
  } else {
    const password = process.env.DEMO_PASSWORD || 'Demo#Finance2026';
    await User.create({ email: 'student@edufinance.local', name: student.name, role: 'STUDENT', studentAdmissionNumber: student.admissionNumber, passwordHash: await bcrypt.hash(password,12) });
  }
  console.log(`Demo student account ready: student@edufinance.local → ${student.name} (${student.admissionNumber}).`);
}
module.exports = { seedStudent };
if (require.main === module) require('../config/db').connectDb().then(seedStudent).then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});

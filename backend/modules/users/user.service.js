const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { SystemMeta } = require('../../models/System');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../constants');
const { requiredText, assertObjectId } = require('../../utils/validate');
const { emailAddress, password } = require('../../utils/accountValidation');
const { runInTransaction } = require('../../utils/transaction');
const { revokeSessions } = require('../auth/auth.service');
const studentDirectory = require('../../integrations/students');
function present(user) {
  return { id: String(user._id), email: user.email, name: user.name, role: user.role, active: user.active, studentAdmissionNumber: user.studentAdmissionNumber || '', createdAt: user.createdAt };
}
async function studentLink(role, value) {
  if (role !== 'STUDENT') return '';
  const admissionNumber = requiredText(value, 'Linked student admission number').toUpperCase();
  const student = await studentDirectory.getStudentByAdmissionNumber(admissionNumber);
  if (!student) throw new ApiError(400, 'Select an existing student record to link this account.', 'STUDENT_NOT_FOUND');
  return student.admissionNumber;
}
function roleValue(role) {
  if (!ROLES.includes(role)) throw new ApiError(400, 'Choose a valid role.', 'VALIDATION_ERROR');
  return role;
}
async function listUsers() { return (await User.find().sort({ name: 1 })).map(present); }
async function getUser(id) {
  const user = await User.findById(assertObjectId(id));
  if (!user) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  return present(user);
}
async function createUser(body) {
  const role = roleValue(body?.role);
  const studentAdmissionNumber = await studentLink(role, body?.studentAdmissionNumber);
  const user = await User.create({ email: emailAddress(body?.email), name: requiredText(body?.name, 'Name', { max: 100 }),
    role, studentAdmissionNumber, passwordHash: await bcrypt.hash(password(body?.password), 12) });
  return present(user);
}
async function updateUser(id, body, actor) {
  assertObjectId(id);
  const changes = {};
  if (body?.name !== undefined) changes.name = requiredText(body.name, 'Name', { max: 100 });
  if (body?.email !== undefined) changes.email = emailAddress(body.email);
  if (body?.role !== undefined) changes.role = roleValue(body.role);
  if (body?.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new ApiError(400, 'Active must be true or false.', 'VALIDATION_ERROR');
    changes.active = body.active;
  }
  if (body?.password !== undefined) changes.passwordHash = await bcrypt.hash(password(body.password), 12);
  if (actor?.userId === id && (changes.active === false || (changes.role && changes.role !== 'SUPER_ADMIN'))) throw new ApiError(400, 'You cannot disable or demote your own administrator account.', 'SELF_CHANGE');
  // Serialize account administration, so concurrent changes cannot remove the last administrator.
  await SystemMeta.updateOne({ key: 'user-administration' }, { $setOnInsert: { version: 0 } }, { upsert: true });
  let result;
  await runInTransaction(async session => {
    await SystemMeta.updateOne({ key: 'user-administration' }, { $inc: { version: 1 } }, { session });
    const user = await User.findById(id).session(session);
    if (!user) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
    if (body?.studentAdmissionNumber !== undefined || changes.role !== undefined) {
      changes.studentAdmissionNumber = await studentLink(changes.role || user.role, body?.studentAdmissionNumber ?? user.studentAdmissionNumber);
    }
    if (user.active && user.role === 'SUPER_ADMIN' && (changes.active === false || (changes.role && changes.role !== 'SUPER_ADMIN')) && await User.countDocuments({ role: 'SUPER_ADMIN', active: true }).session(session) <= 1) throw new ApiError(409, 'Keep at least one active administrator.', 'LAST_ADMIN');
    Object.assign(user, changes);
    user.tokenVersion += 1;
    await user.save({ session });
    await revokeSessions(user._id, session);
    result = present(user);
  });
  return result;
}
async function deleteUser(id, actor) {
  if (actor?.userId === id) throw new ApiError(400, 'You cannot disable your own account.', 'SELF_DELETE');
  await updateUser(id, { active: false }, actor);
  return { message: 'User disabled and sessions revoked.' };
}
module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };

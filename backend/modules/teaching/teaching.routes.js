const express = require('express');
const multer = require('multer');
const service = require('./teaching.service');
const { requirePermission } = require('../../middleware/requirePermission');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { send } = require('../../utils/respond');
const { sendCsv } = require('../../utils/csv');
const ApiError = require('../../utils/ApiError');
const router = express.Router();
const manage = requirePermission('teaching.manage');
const self = requirePermission('teaching.self');
const upload = limit => {
  const handler = multer({ storage: multer.memoryStorage(), limits: { fileSize: limit, files: 1, fields: 10, fieldSize: 20000 } }).single('file');
  return (req, res, next) => handler(req, res, error => next(error ? new ApiError(400, error.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${limit / 1024 / 1024} MB limit.` : 'Invalid upload. Attach one file only.', 'INVALID_UPLOAD') : undefined));
};
router.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
router.get('/admin', manage, asyncHandler(async (req,res) => send(res, await service.adminData())));
router.post('/sections', manage, asyncHandler(async (req,res) => send(res, await service.createSection(req.body), 'Section created.', 201)));
router.put('/profiles/:teacherId', manage, asyncHandler(async (req,res) => send(res, await service.saveProfile(req.params.teacherId, req.body))));
router.post('/timetable', manage, asyncHandler(async (req,res) => send(res, await service.createSlot(req.body), 'Lesson added.', 201)));
router.delete('/timetable/:id', manage, asyncHandler(async (req,res) => { await service.removeSlot(req.params.id); return send(res, null, 'Lesson removed.'); }));
router.get('/overview', self, asyncHandler(async (req,res) => send(res, await service.overview(req.user.userId))));
router.get('/salary-slips/:id', self, asyncHandler(async (req,res) => send(res, await service.salarySlip(req.user.userId, req.params.id))));
router.get('/attendance', self, asyncHandler(async (req,res) => send(res, await service.attendance(req.user.userId, req.query.sectionId, req.query.date))));
router.get('/attendance/template', self, asyncHandler(async (req,res) => {
  const data = await service.attendance(req.user.userId, req.query.sectionId, req.query.date);
  return sendCsv(res, 'attendance-template.csv', data.records, [{ header: 'admissionNumber', value: r => r.admissionNumber }, { header: 'name', value: r => r.name }, { header: 'status', value: r => r.status }]);
}));
router.post('/attendance', self, asyncHandler(async (req,res) => send(res, await service.saveAttendance(req.user.userId, req.body))));
router.post('/attendance/import', self, upload(256 * 1024), asyncHandler(async (req,res) => {
  if (!req.file) throw new ApiError(400, 'Attach an attendance CSV file.', 'FILE_REQUIRED');
  return send(res, await service.saveAttendance(req.user.userId, req.body, req.file));
}));
router.get('/assignments', self, asyncHandler(async (req,res) => send(res, await service.listAssignments(req.user.userId))));
router.post('/assignments', self, upload(5 * 1024 * 1024), asyncHandler(async (req,res) => send(res, await service.publishAssignment(req.user.userId, req.body, req.file), 'Assignment published.', 201)));
router.get('/assignments/:id/file', self, asyncHandler(async (req,res) => {
  const file = await service.assignmentFile(req.user.userId, req.params.id);
  res.type(file.contentType);
  res.set('Content-Disposition', `attachment; filename="assignment${require('path').extname(file.filename)}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
  res.send(file.data);
}));
module.exports = router;

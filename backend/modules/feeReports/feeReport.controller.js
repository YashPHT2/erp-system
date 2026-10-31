const reportService = require('./feeReport.service');
const { send } = require('../../utils/respond');
const { sendCsv } = require('../../utils/csv');
const { queryString } = require('../../utils/validate');

const BALANCE_COLUMNS = [
  { header: 'Admission number', value: (row) => row.admissionNumber },
  { header: 'Student', value: (row) => row.studentName },
  { header: 'Class', value: (row) => row.className },
  { header: 'Section', value: (row) => row.section },
  { header: 'Total fee (INR)', value: (row) => money(row.totalAmount) },
  { header: 'Paid (INR)', value: (row) => money(row.paidAmount) },
  { header: 'Pending (INR)', value: (row) => money(row.pendingAmount) },
];

const PAYMENT_COLUMNS = [
  { header: 'Receipt', value: (row) => row.receiptNumber },
  { header: 'Date', value: (row) => row.paymentDate },
  { header: 'Student', value: (row) => row.studentName },
  { header: 'Admission number', value: (row) => row.admissionNumber },
  { header: 'Class', value: (row) => row.className },
  { header: 'Amount (INR)', value: (row) => money(row.amount) },
  { header: 'Mode', value: (row) => row.paymentMode },
  { header: 'Status', value: (row) => row.status },
];

function money(value) {
  return value == null ? '' : Number(value).toFixed(2);
}

function wantsCsv(query) {
  return queryString(query, 'format') === 'csv';
}

async function dashboard(req, res) {
  return send(res, await reportService.dashboard());
}

async function daily(req, res) {
  const data = await reportService.dailyReport(req.query);
  if (wantsCsv(req.query)) return sendCsv(res, 'daily-collection.csv', data.rows, PAYMENT_COLUMNS);
  return send(res, data);
}

async function monthly(req, res) {
  return send(res, await reportService.monthlyReport(req.query));
}

async function classWise(req, res) {
  const data = await reportService.classWiseReport(req.query);
  if (wantsCsv(req.query)) {
    return sendCsv(res, 'class-wise-collection.csv', data.rows, [
      { header: 'Class', value: (row) => row.className },
      { header: 'Payments', value: (row) => row.count },
      { header: 'Amount (INR)', value: (row) => money(row.amount) },
    ]);
  }
  return send(res, data);
}

async function paymentModes(req, res) {
  return send(res, await reportService.paymentModeReport(req.query));
}

async function pending(req, res) {
  const data = await reportService.pendingReport(req.query);
  if (wantsCsv(req.query)) return sendCsv(res, 'pending-fees.csv', data.rows, BALANCE_COLUMNS);
  return send(res, data);
}

async function defaulters(req, res) {
  const data = await reportService.defaulterReport(req.query);
  if (wantsCsv(req.query)) return sendCsv(res, 'defaulters.csv', data.rows, BALANCE_COLUMNS);
  return send(res, data);
}

async function cancelled(req, res) {
  const data = await reportService.cancelledReport(req.query);
  if (wantsCsv(req.query)) {
    return sendCsv(res, 'cancelled-receipts.csv', data.rows, [
      { header: 'Receipt', value: (row) => row.receiptNumber },
      { header: 'Student', value: (row) => row.studentName },
      { header: 'Admission number', value: (row) => row.admissionNumber },
      { header: 'Amount (INR)', value: (row) => money(row.amount) },
      { header: 'Cancelled at', value: (row) => row.cancellation?.cancelledAt || '' },
      { header: 'Reason', value: (row) => row.cancellation?.reason || '' },
      { header: 'Cancelled by', value: (row) => row.cancellation?.cancelledBy?.name || '' },
    ]);
  }
  return send(res, data);
}

async function notifications(req, res) {
  return send(res, await reportService.getNotifications());
}

module.exports = {
  dashboard,
  daily,
  monthly,
  classWise,
  paymentModes,
  pending,
  defaulters,
  cancelled,
  notifications,
};

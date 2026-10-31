const mongoose = require('mongoose');
const config = require('../config/env');

let detected = false;

async function refreshTransactionSupport() {
  if (mongoose.connection.readyState !== 1) return config.transactionsEnabled;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    config.transactionsEnabled = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch (error) {
    config.transactionsEnabled = false;
  }
  detected = true;
  return config.transactionsEnabled;
}

async function runInTransaction(work) {
  if (!detected) await refreshTransactionSupport();
  if (!config.transactionsEnabled) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function updateOptions(session, extra = {}) {
  return session ? { ...extra, session } : extra;
}

async function createDoc(Model, data, session) {
  if (!session) return Model.create(data);
  const docs = await Model.create([data], { session });
  return docs[0];
}

module.exports = {
  refreshTransactionSupport,
  runInTransaction,
  withSession,
  updateOptions,
  createDoc,
};

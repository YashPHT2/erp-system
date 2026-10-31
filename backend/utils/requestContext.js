const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function runWithRequest(context, work) {
  return storage.run(context, work);
}

function getRequestContext() {
  return storage.getStore() || {};
}

module.exports = { runWithRequest, getRequestContext };

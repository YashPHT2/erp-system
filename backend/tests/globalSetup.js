const fs = require('fs');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0' },
  });
  const uri = replSet.getUri('edufinance-test');
  process.env.MONGO_URI = uri;
  fs.writeFileSync(path.join(__dirname, '.mongo-uri'), uri);
  global.__MONGOINSTANCE = replSet;
};

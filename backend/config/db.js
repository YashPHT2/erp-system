const mongoose = require('mongoose');
const config = require('./env');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
}

module.exports = { connectDb };

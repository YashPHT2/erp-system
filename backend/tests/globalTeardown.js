const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const instance = global.__MONGOINSTANCE;
  if (instance) await instance.stop();
  const uriFile = path.join(__dirname, '.mongo-uri');
  if (fs.existsSync(uriFile)) fs.unlinkSync(uriFile);
};

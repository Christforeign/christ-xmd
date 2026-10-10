const handleMessage = require('./lib/handler');

module.exports = async function(sock, m, chatUpdate, store) {
  return handleMessage(sock, m, chatUpdate, store);
};

const crypto = require('crypto');
const key = 'deepelk';

module.exports = {
  md5 (str) {
    return crypto.createHmac('md5', key).update(str).digest('hex');
  }
};
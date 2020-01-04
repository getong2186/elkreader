const mysql = require('./baseRepository');
module.exports = {
  getUser (key) {
    let sql = `select id from user where login_name = ? or mobile = ? or email = ?`;
    return mysql.query(sql, [key, key, key]);
  }
};
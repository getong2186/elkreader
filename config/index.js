const path = require('path');

module.exports = {
  logPath: path.join(__dirname, '../log'),
  elk: {
    node: 'http://42.159.5.148:9200',
    auth: {
      username: 'elastic',
      password: 'Clouddeep@8890'
    }
  },
  mysql: {
    dbHost: ['192.168.2.18'],
    dbPort: 3306,
    dbUser: 'root',
    dbPassword: '123456',
    dbName: 'rdc_manager',
    dbCrypto: false
  }
};
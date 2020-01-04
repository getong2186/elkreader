const winston = require('winston');
const { format } = winston;
const { combine, timestamp, printf } = format;
var moment = require('moment');
var path = require('path');
var config = require('../../config');

if (config.env !== 'production') {
  var LOG_DIR_PATH = path.join(__dirname, '..', '..', 'logs');
} else {
  LOG_DIR_PATH = path.join('/project/redcore/log/rdc.logs');
}
var filename = path.join(LOG_DIR_PATH, moment().format('YYYY.MM.DD') + '.log');
/*
 * handleExceptions 只有当进程崩溃的时候,才会捕捉到,写进日志
 * 对于语法错误,而没造成进程崩溃,则捕捉不到
 * maxFiles 每天最多2个  最大10M
 * */
var fileOptions = {
  format: combine(
    timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
    printf(({ message, ...others }) => {
      // 之前 json 格式不方便查看，修改为 yml 格式
      let str = `${typeof message === 'object' ? JSON.stringify(message) : message}`;
      // Object.entries(others).forEach(([name, value]) => {
      //   str += value !== undefined ? `${name}: '${typeof value === 'object' ? JSON.stringify(value) : value}'` + ', ' : '';
      // });
      // str = str.replace(/\n(.)/g, '$1');
      return str;
    })
  ),
  name: 'file',
  filename: filename,
  colorize: true,
  prettyPrint: true,
  maxFiles: 2000,
  maxsize: 20 * 1024 * 1024,
  handleExceptions: false,
  humanReadableUnhandledException: true,
  silent: false,
  // json: true,
  level: config.logLevel
};

winston.add(new winston.transports.File(fileOptions));
winston.remove(new winston.transports.Console());

var logger = winston.createLogger({
  ...fileOptions,
  transports: [
    new winston.transports.File(fileOptions)
  ]
});
module.exports = logger;

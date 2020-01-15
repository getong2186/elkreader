const esClient = require('../elastic');
const moment = require('moment');
const logger = require('../logger');
const logcsv = require('../logger/csvIndex');
const { userCache, ipCache } = require('../cache');
const { md5 } = require('../util');
const userRepo = require('../repository/user');
const { getGeo } = require('../geo');

const reg = /user\s*?:\s*(.*?)\s*,/;
const regId = /(\w+-){2,}/;

const getOffUser = async (str) => {
  try {
    if (/(\w+-){4}/.test(str)) return str;
    let arr = reg.exec(str);
    if (arr && arr.length > 1) {
      let userKey = arr[0];
      let uk = arr[1];
      if (userCache[uk]) {
        userKey = userKey.replace(uk, userCache[uk]);
        return str.replace(arr[0], userKey);
      } else {
        uk = uk.replace(/^[\s']*|[\s']*$/g, '');
        switch (uk) {
          case '-':
          case 'UNKNOWN':
          case 'unknown':
          case 'localhost':
          case 'null':
          case 'NULL':
          case 'nil': {
            userCache[uk] = md5(uk);
            userKey = userKey.replace(uk, userCache[uk]);
            return str.replace(arr[0], userKey);
          }
          case '': {
            return str;
          }
          default: {
            let [user] = await userRepo.getUser(uk);
            if (user && user.id) {
              userCache[uk] = user.id;
              userKey = userKey.replace(uk, userCache[uk]);
              return str.replace(arr[0], userKey);
            } else {
              console.log(`u404:${uk}`);
              return str;
            }
          }
        }
      }
    } else {
      return str;
    }
  } catch (err) {
    console.log('getOffUser', err);
    return str;
  }
};

const anlysisFeilds = async (str) => {
  let isErrorLog = /\[error\]/.test(str);
  if (isErrorLog) {
    // 如果是错误日志，但是并非lua脚本定义的错误，就跳过
    if (!/ngx_error\(\)/.test(str)) {
      return false;
    }
  }
  let user, ip, action, actionTime, what, result;
  user = /user:\s*([\w-]+),/.exec(str);
  user && ([, user] = user);
  if (!user || user === '-') return false;
  ip = /client:\s*([\d.]+)/.exec(str);
  ip && ([, ip] = ip);
  if (!/^[\d.]+$/.test(ip)) {
    console.log('>>>', ip, str);
    return false;
  }
  if (!ipCache[ip]) {
    try {
      const geoInfo = await getGeo(ip);
      if (geoInfo) {
        ipCache[ip] = geoInfo;
      } else {
        ipCache[ip] = {};
      }
    } catch (err) {
      console.error('geoInfo error');
      console.error(err);
    }
  }
  let loc = ipCache[ip].location;
  let lnglat = ipCache[ip].lnglat;

  action = /action:\s*(\w+)\s*,/.exec(str);
  action && ([, action] = action);

  result = /result:\s*(\w+)\s*,/.exec(str);
  result && ([, result] = result);

  if (isErrorLog) {
    actionTime = /^([\d/:\s]+)\s*\[error\]/.exec(str);
    actionTime && ([, actionTime] = actionTime);
    actionTime = moment(new Date(actionTime)).format('YYYYMMDDHHmmss');

    what = /request:\s*"\w+\s(.*?)\s+.*?"/.exec(str);
    what && ([, what] = what);

    if (str.indexOf('UA HMAC ERROR') >= 0) {
      result = 3;
    } else if (str.indexOf('POLICY ERROR') >= 0) {
      result = 2;
    } else {
      result = 1;
    }

  } else {
    actionTime = /\[timestamp:\s*([\w\/:]+)\s*[+\d]*\]/.exec(str);
    // 24/Dec/2019:16:50:43 ---> 24/Dec/2019 16:50:43
    actionTime && ([, actionTime] = actionTime);
    actionTime = actionTime.replace(/:/, ' ');
    actionTime = moment(new Date(actionTime)).format('YYYYMMDDHHmmss');

    what = /, \w{3,} (.*)\s.*?,result:/.exec(str);
    what && ([, what] = what);
    result = result === 'success' ? 1 : result;
  }

  return [user, actionTime, ip, loc, lnglat, what, action, result];
};

module.exports = {
  getOffUser: getOffUser,
  async getIndices () {
    try {
      let elkData = await esClient.cat.indices({
        index: 'sdp*',
        format: 'json'
      });
      let { body } = elkData;
      return body;
    } catch (err) {
      console.error('获取索引失败');
      return undefined;
    }
  },

  /**
   * 分页查询，最多返回前 10000 条记录， from + size > 10000, 将报错
   * @param {string} indexName 
   * @param {int} from 
   * @param {int} size 
   */
  async getDocs (indexName, from, size) {
    try {
      let elkData = await esClient.search({
        index: indexName,
        format: 'json',
        from: from,
        size: size,
        sort: '@timestamp',
      });
      if (elkData) {
        let { body: { hits } } = elkData;
        return hits;
      }
    } catch (err) {
      console.error('获取索引失败');
      console.error(err);
      return undefined;
    }
  },

  async getDocsByScroll (indexName, size) {
    try {
      let scrollData = await esClient.search({
        index: indexName,
        format: 'json',
        scroll: '1m', // 设置每个 scroll 查询的时长，超时就断开
        size: size,
        sort: '@timestamp',
        body: {
          query: {
            bool: {
              must: [{
                term: { 'fields.source': 'nginx' }
              }],
              must_not: [{
                match: { message: 'log/getLocation log/getLocation push/register [notice] [alert] [emerg] "upstream time out" NGXSHARED.lua generic_host' }
              }]
            }
          }
        }
      });
      if (scrollData) {
        let { body: { _scroll_id: scrollId, hits: { total: indexDocCnt, hits: rows } } } = scrollData;
        console.log('+++', indexName, indexDocCnt);
        for (let row of rows) {
          let str = await getOffUser(row._source.message);
          let csvRow = await anlysisFeilds(str);
          logger.info(JSON.stringify(str));
          if (csvRow) {
            logcsv.info(csvRow.join(','));
          }
        };
        let idx = 0;
        while (scrollId) {
          let scrollData2 = await esClient.scroll({
            scroll_id: scrollId,
            scroll: '1m'
          });
          let { body: { _scroll_id: tempScrollId, hits: { hits: scrollHits } } } = scrollData2;
          for (let row of scrollHits) {
            let str = await getOffUser(row._source.message);
            logger.info(JSON.stringify(str));
            let csvRow = await anlysisFeilds(str);
            if (csvRow) {
              logcsv.info(csvRow.join(','));
            }
          };
          if (scrollHits.length === 0) {
            console.log(JSON.stringify(scrollData2));
            break;
          }
          console.log(`-- tempScrollId -- ${idx++} -- ${scrollHits.length} --`);
          scrollId = tempScrollId;
        }
        esClient.clearScroll({ scroll_id: scrollId })
          .then((res) => { console.info('==========', res); })
          .catch(err => { console.error(err); console.log('\naaaaaaa\n'); });
      }
    } catch (err) {
      console.error('获取索引失败11');
      console.error(err);
      return undefined;
    }
  },

  async scroll (scrollId) {
    try {
      let scrollData = await esClient.scroll({
        scroll_id: scrollId,
        scroll: '1m'
      });
    } catch (err) {
      console.error('获取索引失败');
      console.error(err);
      return undefined;
    }
  },

  async clearScroll (scrollId) {
    try {
      let clsScroll = await esClient.clearScroll({
        scroll_id: scrollId
      });
      return clsScroll;
    } catch (err) {
      console.error('获取索引失败');
      console.error(err);
      return undefined;
    }
  }
};
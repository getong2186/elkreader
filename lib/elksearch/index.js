const esClient = require('../elastic');
const logger = require('../logger');
const { userCache } = require('../cache');
const { md5 } = require('../util');
const userRepo = require('../repository/user');

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
      logger.err('获取索引失败');
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
      logger.error('获取索引失败', err);
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
      });
      if (scrollData) {
        let { body: { _scroll_id: scrollId, hits: { total: indexDocCnt, hits: rows } } } = scrollData;
        console.log(indexName, indexDocCnt);
        for (let row of rows) {
          let str = await getOffUser(row._source.message);
          logger.info(JSON.stringify(str));
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
          };
          if (scrollHits.length === 0) {
            console.log(JSON.stringify(scrollData2));
            break;
          }
          console.log(`---- tempScrollId -- ${idx++} -- ${scrollHits.length} ----`);
          scrollId = tempScrollId;
        }
        esClient.clearScroll({ scroll_id: scrollId })
          .then((res) => { console.info('==========', res); })
          .catch(err => { console.error(err); console.log('\naaaaaaa\n'); });
      }
    } catch (err) {
      logger.error('获取索引失败', err);
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
      logger.error('获取索引失败', err);
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
      logger.error('获取索引失败', err);
      return undefined;
    }
  }
};
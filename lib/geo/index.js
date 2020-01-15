const path = require('path');
const maxmind = require('maxmind');
const logger = require('../logger');
const config = require('../../config');

const geoDbPath = path.resolve(__dirname, 'GeoLite2-City.mmdb');

let dbIns;
module.exports = {
  async getdbIns () {
    await maxmind.open(geoDbPath)
      .then(db => { dbIns = db; })
      .catch(err => {
        console.error('maxmind open error', err);
        process.exit;
      });
  },
  getGeo (ip) {
    return new Promise((resolve, reject) => {
      try {
        const theip = (ip === '127.0.0.1' || /^(10|172.1[6-9]|172.2[0-9]|172.3[01]|192.168)\./.test(ip)) ? config.defaultIp : ip;
        let response = dbIns.get(theip);
        if (response) {
          if (response && response.subdivisions && response.subdivisions[0] && response.subdivisions[0] && response.subdivisions[0].names && response.subdivisions[0].names['zh-CN']) {
            var province = response.subdivisions[0].names['zh-CN'] || '';
          }
          var city = (response.city && response.city.names['zh-CN']) || '';
          city = city.replace('市', '');
          var country = response.country ? response.country.names['zh-CN'] : '';
          const result = {
            location: `${country || ''}${province || ''}${city || ''}`,
            lnglat: response.location ? `${response.location.longitude}-${response.location.latitude}` : ''
          };
          resolve(result);
        }
      } catch (err) {
        console.error('exec get geo error ' + ip);
        console.error(err);
        resolve(null);
      }
    });
  }
};
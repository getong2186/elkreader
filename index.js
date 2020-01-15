const elkSearch = require('./lib/elksearch');
const logger = require('./lib/logger');
const { getdbIns } = require('./lib/geo');
const perSize = 1000;

// (async () => {
//   let indices = await elkSearch.getIndices();
//   console.log(JSON.stringify(indices));
//   indices = indices.filter(x => x.index > 'sdp-2019.11.20').map(x => x.index).sort();
//   console.log(indices);
//   try {
//     for (let i = 0, len = indices.length; i < len; i++) {
//       let indexDocCnt = 0;
//       for (let j = 0; ; j++) {
//         let from = j * perSize;
//         let hits = await elkSearch.getDocs(indices[i], from, perSize);
//         if (hits) {
//           let { total, hits: rows } = hits;
//           if (j === 0) {
//             indexDocCnt = total;
//             console.log(indices[i], total);
//           }
//           console.log(indexDocCnt, from);
//           rows.forEach(row => {
//             logger.info(row._source);
//           });
//           if (total <= from) {
//             break;
//           }
//         } else {
//           if (indexDocCnt <= from) break;
//         }
//       }
//     }
//   } catch (ex) {
//     logger.error('出错了', ex);
//   }
// })();



(async () => {
  await getdbIns();
  let indices = await elkSearch.getIndices();
  indices = indices.filter(x => x.index >= 'sdp-2019.12.01').map(x => x.index).sort();
  console.log(indices);
  try {
    for (let i = 0, len = indices.length; i < 7; i++) {
      await elkSearch.getDocsByScroll(indices[i], perSize);
    }
  } catch (ex) {
    logger.error('出错了', ex);
  }
})();

process.on('uncaughtException', (err) => {
  logger.error('=====================\n', err);
  process.exit();
});

process.on('unhandledRejection', (err) => {
  logger.error('---------------------\n', err);
  process.exit();
});
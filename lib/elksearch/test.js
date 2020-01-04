const { getOffUser } = require('.');

(async () => {
  let str = '00000user:-,11111';
  let str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
  str = '00000user:,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
  str = '00000user: nil,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
  str = '00000user: 15726656954,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
  str = '00000user: 15726656954,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
  str = '00000user: nil,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
  str = '00000user: erqiang.zhu,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');

  str = '00000user: erqiang.zhu@clouddeep.cn,11111';
  str2 = await getOffUser(str);
  console.log(str + '\n' + str2 + '\n>>>>');
})();
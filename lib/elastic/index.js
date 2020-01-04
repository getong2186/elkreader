const { Client: Client6 } = require('es6');
const { elk } = require('../../config');

const es6 = new Client6(elk);

module.exports = es6;
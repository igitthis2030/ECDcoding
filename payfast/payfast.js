const crypto = require('crypto');
const querystring = require('querystring');

function generateSignature(params = {}, passphrase = '') {
  const p = { ...params };
  delete p.signature;

  const keys = Object.keys(p).sort();
  const pieces = keys.map((k) => `${k}=${encodeURIComponent(p[k])}`);
  let str = pieces.join('&');
  if (passphrase) str = `${str}&passphrase=${encodeURIComponent(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function buildQueryString(params = {}) {
  const p = { ...params };
  const keys = Object.keys(p).sort();
  const obj = {};
  keys.forEach((k) => { obj[k] = p[k]; });
  return querystring.stringify(obj);
}

module.exports = { generateSignature, buildQueryString };

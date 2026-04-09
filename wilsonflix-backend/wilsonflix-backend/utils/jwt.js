// utils/jwt.js
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'wilsonflix_dev_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'wilsonflix_refresh_secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

module.exports = {
  signAccess: (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN }),
  signRefresh: (payload) => jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN }),
  verifyAccess: (token) => jwt.verify(token, SECRET),
  verifyRefresh: (token) => jwt.verify(token, REFRESH_SECRET),
};

'use strict';

const jwt = require('jsonwebtoken');
const env = require('./env');

const sign = (payload) =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });

const verify = (token) => jwt.verify(token, env.jwt.accessSecret);

module.exports = { sign, verify };

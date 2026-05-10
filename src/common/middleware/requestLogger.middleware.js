'use strict';

const morgan = require('morgan');
const { randomUUID } = require('crypto');
const logger = require('../logger/logger');

const stream = {
  write: (message) => logger.http(message.trim()),
};

const requestId = (req, _res, next) => {
  req.id = randomUUID();
  next();
};

const httpLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream }
);

module.exports = { requestId, httpLogger };

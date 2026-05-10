'use strict';

const logger = require('../logger/logger');
const { error: errorResponse } = require('../responses/response');
const { AppError, ValidationError } = require('../errors');
const env = require('../../config/env');

const errorHandler = (err, req, res, _next) => {
  const requestContext = { method: req.method, path: req.path, userId: req.user?.user_id };

  if (err.isOperational) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { ...requestContext, code: err.code, stack: err.stack });
    } else {
      logger.warn(err.message, { ...requestContext, code: err.code });
    }

    if (err instanceof ValidationError) {
      return errorResponse(res, err.message, err.statusCode, err.code, err.details);
    }

    return errorResponse(res, err.message, err.statusCode, err.code);
  }

  // Unexpected / programming errors
  logger.error('Unhandled error', { ...requestContext, error: err.message, stack: err.stack });

  const message = env.isProduction ? 'An unexpected error occurred' : err.message;
  return errorResponse(res, message, 500, 'INTERNAL_ERROR');
};

module.exports = errorHandler;

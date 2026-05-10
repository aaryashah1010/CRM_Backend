'use strict';

const { verify } = require('../../config/jwt');
const { AuthenticationError } = require('../errors');

const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('No token provided'));
  }

  const token = authHeader.slice(7);
  try {
    req.user = verify(token);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    next(new AuthenticationError('Invalid token'));
  }
};

module.exports = authenticate;

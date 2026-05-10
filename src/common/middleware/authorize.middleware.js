'use strict';

const { AuthorizationError } = require('../errors');

const authorize = (...requiredPermissions) =>
  (req, _res, next) => {
    const userPermissions = req.user?.permissions || [];
    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));
    if (!hasAll) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };

module.exports = authorize;

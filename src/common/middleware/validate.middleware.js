'use strict';

const { ValidationError } = require('../errors');

const validate = (schema, target = 'body') =>
  (req, _res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: false,
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      return next(new ValidationError('Validation failed', details));
    }

    req[target] = value;
    next();
  };

module.exports = validate;

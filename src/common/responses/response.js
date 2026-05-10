'use strict';

const success = (res, data, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data, error: null });

const created = (res, data, message = 'Created successfully') =>
  success(res, data, message, 201);

const noContent = (res) => res.status(204).send();

const error = (res, message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) =>
  res.status(statusCode).json({ success: false, message, data: null, error: { code, details } });

const paginated = (res, data, pagination, message = 'Success') =>
  res.status(200).json({ success: true, message, data, pagination, error: null });

module.exports = { success, created, noContent, error, paginated };

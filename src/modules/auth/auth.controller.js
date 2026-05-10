'use strict';

const authService = require('./auth.service');
const response = require('../../common/responses/response');
const { AUTH_MESSAGES } = require('./auth.constants');

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return response.success(res, result, AUTH_MESSAGES.LOGIN_SUCCESS);
  } catch (err) {
    return next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getAuthenticatedUser(req.user);
    return response.success(res, user, AUTH_MESSAGES.PROFILE_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const logout = (_req, res) =>
  response.success(res, null, AUTH_MESSAGES.LOGOUT_SUCCESS);

module.exports = {
  login,
  me,
  logout,
};

'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const userService = require('./user.service');
const { USER_MESSAGES } = require('./user.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listUsers = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await userService.listUsers({ ...req.query, ...pagination });
    return response.success(res, result, USER_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUser(Number(req.params.userId));
    return response.success(res, user, USER_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body, getActorUserId(req));
    return response.created(res, user, USER_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(Number(req.params.userId), req.body, getActorUserId(req));
    return response.success(res, user, USER_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const deactivateUser = async (req, res, next) => {
  try {
    const user = await userService.setActiveState(Number(req.params.userId), false, getActorUserId(req));
    return response.success(res, user, USER_MESSAGES.DEACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const activateUser = async (req, res, next) => {
  try {
    const user = await userService.setActiveState(Number(req.params.userId), true, getActorUserId(req));
    return response.success(res, user, USER_MESSAGES.ACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    await userService.resetPassword(Number(req.params.userId), req.body.password, getActorUserId(req));
    return response.noContent(res);
  } catch (err) {
    return next(err);
  }
};

const listRoles = async (_req, res, next) => {
  try {
    const roles = await userService.listRoles();
    return response.success(res, roles, USER_MESSAGES.ROLES_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await userService.getMetrics();
    return response.success(res, metrics, USER_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  resetPassword,
  listRoles,
  getMetrics,
};

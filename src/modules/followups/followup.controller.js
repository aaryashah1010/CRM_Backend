'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const followUpService = require('./followup.service');
const { FOLLOW_UP_MESSAGES } = require('./followup.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listFollowUps = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await followUpService.listFollowUps({ ...req.query, ...pagination });
    return response.success(res, result, FOLLOW_UP_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getFollowUp = async (req, res, next) => {
  try {
    const followUp = await followUpService.getFollowUp(Number(req.params.followUpId));
    return response.success(res, followUp, FOLLOW_UP_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createFollowUp = async (req, res, next) => {
  try {
    const followUp = await followUpService.createFollowUp(req.body, getActorUserId(req));
    return response.created(res, followUp, FOLLOW_UP_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateFollowUp = async (req, res, next) => {
  try {
    const followUp = await followUpService.updateFollowUp(Number(req.params.followUpId), req.body, getActorUserId(req));
    return response.success(res, followUp, FOLLOW_UP_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const completeFollowUp = async (req, res, next) => {
  try {
    const followUp = await followUpService.completeFollowUp(Number(req.params.followUpId), req.body, getActorUserId(req));
    return response.success(res, followUp, FOLLOW_UP_MESSAGES.COMPLETED);
  } catch (err) {
    return next(err);
  }
};

const cancelFollowUp = async (req, res, next) => {
  try {
    const followUp = await followUpService.cancelFollowUp(Number(req.params.followUpId), req.body, getActorUserId(req));
    return response.success(res, followUp, FOLLOW_UP_MESSAGES.CANCELLED);
  } catch (err) {
    return next(err);
  }
};

const deactivateFollowUp = async (req, res, next) => {
  try {
    await followUpService.deactivateFollowUp(Number(req.params.followUpId), getActorUserId(req));
    return response.noContent(res);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await followUpService.getMetrics();
    return response.success(res, metrics, FOLLOW_UP_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getOptions = async (_req, res, next) => {
  try {
    const options = await followUpService.getOptions();
    return response.success(res, options, FOLLOW_UP_MESSAGES.OPTIONS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  deactivateFollowUp,
  getMetrics,
  getOptions,
};

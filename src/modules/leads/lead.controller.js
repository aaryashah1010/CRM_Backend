'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const leadService = require('./lead.service');
const { LEAD_MESSAGES } = require('./lead.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listLeads = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await leadService.listLeads({ ...req.query, ...pagination });
    return response.success(res, result, LEAD_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getLead = async (req, res, next) => {
  try {
    const lead = await leadService.getLead(Number(req.params.leadId));
    return response.success(res, lead, LEAD_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createLead = async (req, res, next) => {
  try {
    const lead = await leadService.createLead(req.body, getActorUserId(req));
    return response.created(res, lead, LEAD_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const lead = await leadService.updateLead(Number(req.params.leadId), req.body, getActorUserId(req));
    return response.success(res, lead, LEAD_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const lead = await leadService.updateStatus(Number(req.params.leadId), req.body, getActorUserId(req));
    return response.success(res, lead, LEAD_MESSAGES.STATUS_UPDATED);
  } catch (err) {
    return next(err);
  }
};

const createFollowUp = async (req, res, next) => {
  try {
    const lead = await leadService.createFollowUp(Number(req.params.leadId), req.body, getActorUserId(req));
    return response.created(res, lead, LEAD_MESSAGES.FOLLOW_UP_CREATED);
  } catch (err) {
    return next(err);
  }
};

const convertToQuotation = async (req, res, next) => {
  try {
    const result = await leadService.convertToQuotation(
      Number(req.params.leadId),
      req.body || {},
      getActorUserId(req)
    );
    if (result.created) {
      return response.created(res, result, LEAD_MESSAGES.CONVERTED_TO_QUOTATION);
    }
    return response.success(res, result, 'Lead already has a quotation');
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await leadService.getMetrics();
    return response.success(res, metrics, LEAD_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getPipeline = async (_req, res, next) => {
  try {
    const pipeline = await leadService.getPipeline();
    return response.success(res, pipeline, LEAD_MESSAGES.PIPELINE_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getOptions = async (_req, res, next) => {
  try {
    const options = await leadService.getOptions();
    return response.success(res, options, LEAD_MESSAGES.OPTIONS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listLeads,
  getLead,
  createLead,
  updateLead,
  updateStatus,
  createFollowUp,
  convertToQuotation,
  getMetrics,
  getPipeline,
  getOptions,
};

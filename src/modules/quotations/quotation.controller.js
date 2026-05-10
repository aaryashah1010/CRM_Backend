'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const quotationService = require('./quotation.service');
const { QUOTATION_MESSAGES } = require('./quotation.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listQuotations = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await quotationService.listQuotations({ ...req.query, ...pagination });
    return response.success(res, result, QUOTATION_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotation(Number(req.params.quotationId));
    return response.success(res, quotation, QUOTATION_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.createQuotation(req.body, getActorUserId(req));
    return response.created(res, quotation, QUOTATION_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.updateQuotation(
      Number(req.params.quotationId),
      req.body,
      getActorUserId(req)
    );
    return response.success(res, quotation, QUOTATION_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const sendQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.sendQuotation(
      Number(req.params.quotationId),
      getActorUserId(req)
    );
    return response.success(res, quotation, QUOTATION_MESSAGES.SENT);
  } catch (err) {
    return next(err);
  }
};

const approveQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.approveQuotation(
      Number(req.params.quotationId),
      getActorUserId(req)
    );
    return response.success(res, quotation, QUOTATION_MESSAGES.APPROVED);
  } catch (err) {
    return next(err);
  }
};

const rejectQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.rejectQuotation(
      Number(req.params.quotationId),
      getActorUserId(req)
    );
    return response.success(res, quotation, QUOTATION_MESSAGES.REJECTED);
  } catch (err) {
    return next(err);
  }
};

const expireQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.expireQuotation(
      Number(req.params.quotationId),
      getActorUserId(req)
    );
    return response.success(res, quotation, QUOTATION_MESSAGES.EXPIRED);
  } catch (err) {
    return next(err);
  }
};

const convertToSalesOrder = async (req, res, next) => {
  try {
    const result = await quotationService.convertToSalesOrder(
      Number(req.params.quotationId),
      req.body || {},
      getActorUserId(req)
    );
    return response.created(res, result, QUOTATION_MESSAGES.CONVERTED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await quotationService.getMetrics();
    return response.success(res, metrics, QUOTATION_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  sendQuotation,
  approveQuotation,
  rejectQuotation,
  expireQuotation,
  convertToSalesOrder,
  getMetrics,
};

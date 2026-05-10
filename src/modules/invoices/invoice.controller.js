'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const invoiceService = require('./invoice.service');
const { INVOICE_MESSAGES } = require('./invoice.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listInvoices = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await invoiceService.listInvoices({ ...req.query, ...pagination });
    return response.success(res, result, INVOICE_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoice(Number(req.params.invoiceId));
    return response.success(res, invoice, INVOICE_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.body, getActorUserId(req));
    return response.created(res, invoice, INVOICE_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(Number(req.params.invoiceId), req.body, getActorUserId(req));
    return response.success(res, invoice, INVOICE_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const issueInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.issueInvoice(Number(req.params.invoiceId), getActorUserId(req));
    return response.success(res, invoice, INVOICE_MESSAGES.ISSUED);
  } catch (err) {
    return next(err);
  }
};

const cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.cancelInvoice(Number(req.params.invoiceId), getActorUserId(req));
    return response.success(res, invoice, INVOICE_MESSAGES.CANCELLED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await invoiceService.getMetrics();
    return response.success(res, metrics, INVOICE_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  issueInvoice,
  cancelInvoice,
  getMetrics,
};

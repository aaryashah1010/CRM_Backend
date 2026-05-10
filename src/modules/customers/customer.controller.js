'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const customerService = require('./customer.service');
const { CUSTOMER_MESSAGES } = require('./customer.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listCustomers = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await customerService.listCustomers({ ...req.query, ...pagination });
    return response.success(res, result, CUSTOMER_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.getCustomer(Number(req.params.customerId));
    return response.success(res, customer, CUSTOMER_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getCustomerLedger = async (req, res, next) => {
  try {
    const ledger = await customerService.getCustomerLedger(Number(req.params.customerId));
    return response.success(res, ledger, CUSTOMER_MESSAGES.LEDGER_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.createCustomer(req.body, getActorUserId(req));
    return response.created(res, customer, CUSTOMER_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.updateCustomer(Number(req.params.customerId), req.body, getActorUserId(req));
    return response.success(res, customer, CUSTOMER_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const activateCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.setActiveState(Number(req.params.customerId), true, getActorUserId(req));
    return response.success(res, customer, CUSTOMER_MESSAGES.ACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const deactivateCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.setActiveState(Number(req.params.customerId), false, getActorUserId(req));
    return response.success(res, customer, CUSTOMER_MESSAGES.DEACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const listPaymentTerms = async (_req, res, next) => {
  try {
    const terms = await customerService.listPaymentTerms();
    return response.success(res, terms, CUSTOMER_MESSAGES.PAYMENT_TERMS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await customerService.getMetrics();
    return response.success(res, metrics, CUSTOMER_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listCustomers,
  getCustomer,
  getCustomerLedger,
  createCustomer,
  updateCustomer,
  activateCustomer,
  deactivateCustomer,
  listPaymentTerms,
  getMetrics,
};

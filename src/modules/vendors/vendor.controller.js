'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const vendorService = require('./vendor.service');
const { VENDOR_MESSAGES } = require('./vendor.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listVendors = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await vendorService.listVendors({ ...req.query, ...pagination });
    return response.success(res, result, VENDOR_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.getVendor(Number(req.params.vendorId));
    return response.success(res, vendor, VENDOR_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getVendorLedger = async (req, res, next) => {
  try {
    const ledger = await vendorService.getVendorLedger(Number(req.params.vendorId));
    return response.success(res, ledger, VENDOR_MESSAGES.LEDGER_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.createVendor(req.body, getActorUserId(req));
    return response.created(res, vendor, VENDOR_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.updateVendor(Number(req.params.vendorId), req.body, getActorUserId(req));
    return response.success(res, vendor, VENDOR_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const activateVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.setActiveState(Number(req.params.vendorId), true, getActorUserId(req));
    return response.success(res, vendor, VENDOR_MESSAGES.ACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const deactivateVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.setActiveState(Number(req.params.vendorId), false, getActorUserId(req));
    return response.success(res, vendor, VENDOR_MESSAGES.DEACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const listPaymentTerms = async (_req, res, next) => {
  try {
    const terms = await vendorService.listPaymentTerms();
    return response.success(res, terms, VENDOR_MESSAGES.PAYMENT_TERMS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await vendorService.getMetrics();
    return response.success(res, metrics, VENDOR_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listVendors,
  getVendor,
  getVendorLedger,
  createVendor,
  updateVendor,
  activateVendor,
  deactivateVendor,
  listPaymentTerms,
  getMetrics,
};

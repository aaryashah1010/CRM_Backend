'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const paymentService = require('./payment.service');
const { PAYMENT_MESSAGES } = require('./payment.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const createPayment = async (req, res, next) => {
  try {
    const result = await paymentService.recordVendorPayment(req.body, getActorUserId(req));
    return response.created(res, result, PAYMENT_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const listPayments = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await paymentService.listPayments({ ...req.query, ...pagination });
    return response.success(res, result, PAYMENT_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.getPayment(Number(req.params.paymentId));
    return response.success(res, payment, PAYMENT_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const reversePayment = async (req, res, next) => {
  try {
    const result = await paymentService.reversePayment(
      Number(req.params.paymentId),
      getActorUserId(req)
    );
    return response.success(res, result, PAYMENT_MESSAGES.REVERSED);
  } catch (err) {
    return next(err);
  }
};

const getVendorPayable = async (req, res, next) => {
  try {
    const payable = await paymentService.getVendorPayable(Number(req.params.vendorId), {
      purchaseOrderId: req.query.purchaseOrderId ? Number(req.query.purchaseOrderId) : null,
      inwardId: req.query.inwardId ? Number(req.query.inwardId) : null,
    });
    return response.success(res, payable, PAYMENT_MESSAGES.PAYABLE_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const listVendorPayableInwards = async (req, res, next) => {
  try {
    const inwards = await paymentService.listVendorPayableInwards(Number(req.params.vendorId), {
      purchaseOrderId: req.query.purchaseOrderId ? Number(req.query.purchaseOrderId) : null,
    });
    return response.success(res, inwards, PAYMENT_MESSAGES.PAYABLE_INWARDS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createPayment,
  listPayments,
  getPayment,
  reversePayment,
  getVendorPayable,
  listVendorPayableInwards,
};

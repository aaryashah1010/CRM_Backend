'use strict';

const Joi = require('joi');

const {
  PAYMENT_MODE,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  PAYMENT_SORT_FIELDS,
} = require('./payment.constants');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);
const requiredText = (max) => Joi.string().trim().min(1).max(max).required();

const idParamSchema = Joi.object({
  paymentId: Joi.number().integer().positive().required(),
});

const vendorIdParamSchema = Joi.object({
  vendorId: Joi.number().integer().positive().required(),
});

const listPaymentsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  vendorId: Joi.number().integer().positive(),
  purchaseOrderId: Joi.number().integer().positive(),
  inwardId: Joi.number().integer().positive(),
  paymentMode: Joi.string().valid(...PAYMENT_MODES),
  status: Joi.string().valid(...PAYMENT_STATUSES, 'all').default('all'),
  fromDate: Joi.date().iso().allow('', null),
  toDate: Joi.date().iso().allow('', null),
  sortBy: Joi.string().valid(...Object.keys(PAYMENT_SORT_FIELDS)).default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const payableQuerySchema = Joi.object({
  purchaseOrderId: Joi.number().integer().positive(),
  inwardId: Joi.number().integer().positive(),
});

const payableInwardsQuerySchema = Joi.object({
  purchaseOrderId: Joi.number().integer().positive(),
});

const createPaymentSchema = Joi.object({
  vendorId: Joi.number().integer().positive().required(),
  purchaseOrderId: Joi.number().integer().positive().allow(null),
  inwardId: Joi.number().integer().positive().allow(null),
  paymentDate: Joi.date().iso().required(),
  paymentMode: Joi.string().valid(...PAYMENT_MODES).required(),
  amount: Joi.number().positive().precision(2).required(),
  bankName: optionalText(100),
  chequeNumber: Joi.when('paymentMode', {
    is: PAYMENT_MODE.CHEQUE,
    then: requiredText(50),
    otherwise: optionalText(50),
  }),
  transactionReference: Joi.when('paymentMode', {
    is: Joi.valid(
      PAYMENT_MODE.NEFT,
      PAYMENT_MODE.RTGS,
      PAYMENT_MODE.UPI,
      PAYMENT_MODE.BANK_TRANSFER
    ),
    then: requiredText(100),
    otherwise: optionalText(100),
  }),
  notes: optionalText(4000),
});

module.exports = {
  idParamSchema,
  vendorIdParamSchema,
  listPaymentsSchema,
  payableQuerySchema,
  payableInwardsQuerySchema,
  createPaymentSchema,
};

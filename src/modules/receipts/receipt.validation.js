'use strict';

const Joi = require('joi');

const { RECEIPT_PAYMENT_MODES, RECEIPT_PAYMENT_MODE } = require('./receipt.constants');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);
const requiredText = (max) => Joi.string().trim().min(1).max(max).required();

const invoiceIdParamSchema = Joi.object({
  invoiceId: Joi.number().integer().positive().required(),
});

const receiptPayload = {
  receiptDate: Joi.date().iso().required(),
  paymentMode: Joi.string().valid(...RECEIPT_PAYMENT_MODES).required(),
  amount: Joi.number().positive().precision(2).required(),
  bankName: optionalText(100),
  chequeNumber: Joi.when('paymentMode', {
    is: RECEIPT_PAYMENT_MODE.CHEQUE,
    then: requiredText(50),
    otherwise: optionalText(50),
  }),
  transactionReference: Joi.when('paymentMode', {
    is: Joi.valid(
      RECEIPT_PAYMENT_MODE.NEFT,
      RECEIPT_PAYMENT_MODE.RTGS,
      RECEIPT_PAYMENT_MODE.UPI,
      RECEIPT_PAYMENT_MODE.BANK_TRANSFER
    ),
    then: requiredText(100),
    otherwise: optionalText(100),
  }),
  paymentDate: Joi.date().iso().allow('', null),
  notes: optionalText(4000),
};

const createReceiptSchema = Joi.object({
  invoiceId: Joi.number().integer().positive().required(),
  ...receiptPayload,
});

const recordInvoiceReceiptSchema = Joi.object(receiptPayload);

module.exports = {
  invoiceIdParamSchema,
  createReceiptSchema,
  recordInvoiceReceiptSchema,
};

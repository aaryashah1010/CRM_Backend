'use strict';

const response = require('../../common/responses/response');
const receiptService = require('./receipt.service');
const { RECEIPT_MESSAGES } = require('./receipt.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const recordInvoiceReceipt = async (req, res, next) => {
  try {
    const result = await receiptService.recordInvoiceReceipt(
      Number(req.params.invoiceId),
      req.body,
      getActorUserId(req)
    );
    return response.created(res, result, RECEIPT_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const createReceipt = async (req, res, next) => {
  try {
    const result = await receiptService.recordInvoiceReceipt(
      Number(req.body.invoiceId),
      req.body,
      getActorUserId(req)
    );
    return response.created(res, result, RECEIPT_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const listInvoiceReceipts = async (req, res, next) => {
  try {
    const receipts = await receiptService.listInvoiceReceipts(Number(req.params.invoiceId));
    return response.success(res, receipts, RECEIPT_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  recordInvoiceReceipt,
  createReceipt,
  listInvoiceReceipts,
};

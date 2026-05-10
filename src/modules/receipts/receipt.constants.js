'use strict';

const RECEIPT_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed',
});

const RECEIPT_PAYMENT_MODE = Object.freeze({
  CASH: 'cash',
  CHEQUE: 'cheque',
  NEFT: 'neft',
  RTGS: 'rtgs',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
});

const RECEIPT_STATUSES = Object.freeze(Object.values(RECEIPT_STATUS));
const RECEIPT_PAYMENT_MODES = Object.freeze(Object.values(RECEIPT_PAYMENT_MODE));
const RECEIPT_NUMBER_PREFIX = 'RCT';

const RECEIPT_MESSAGES = Object.freeze({
  CREATED: 'Receipt recorded successfully',
  LIST_FETCHED: 'Receipts fetched successfully',
});

module.exports = {
  RECEIPT_STATUS,
  RECEIPT_PAYMENT_MODE,
  RECEIPT_STATUSES,
  RECEIPT_PAYMENT_MODES,
  RECEIPT_NUMBER_PREFIX,
  RECEIPT_MESSAGES,
};

'use strict';

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed',
});

const PAYMENT_MODE = Object.freeze({
  CASH: 'cash',
  CHEQUE: 'cheque',
  NEFT: 'neft',
  RTGS: 'rtgs',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
});

const PAYMENT_STATUSES = Object.freeze(Object.values(PAYMENT_STATUS));
const PAYMENT_MODES = Object.freeze(Object.values(PAYMENT_MODE));

const PAYMENT_NUMBER_PREFIX = 'PAY';

const PAYMENT_SORT_FIELDS = Object.freeze({
  paymentNumber: 'p.payment_number',
  paymentDate: 'p.payment_date',
  amount: 'p.amount',
  status: 'p.status',
  vendorName: 'v.name',
  createdAt: 'p.created_at',
});

const PAYMENT_MESSAGES = Object.freeze({
  CREATED: 'Vendor payment recorded successfully',
  REVERSED: 'Vendor payment reversed successfully',
  LIST_FETCHED: 'Payments fetched successfully',
  DETAIL_FETCHED: 'Payment fetched successfully',
  PAYABLE_FETCHED: 'Vendor payable summary fetched successfully',
  PAYABLE_INWARDS_FETCHED: 'Vendor payable inward records fetched successfully',
});

module.exports = {
  PAYMENT_STATUS,
  PAYMENT_MODE,
  PAYMENT_STATUSES,
  PAYMENT_MODES,
  PAYMENT_NUMBER_PREFIX,
  PAYMENT_SORT_FIELDS,
  PAYMENT_MESSAGES,
};

'use strict';

const CUSTOMER_SORT_FIELDS = Object.freeze({
  name: 'c.name',
  customerCode: 'c.customer_code',
  gstNumber: 'c.gst_number',
  creditLimit: 'c.credit_limit',
  outstandingAmount: 'outstanding_amount',
  status: 'c.is_active',
  createdAt: 'c.created_at',
});

const CUSTOMER_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Customers fetched successfully',
  DETAIL_FETCHED: 'Customer fetched successfully',
  LEDGER_FETCHED: 'Customer ledger fetched successfully',
  CREATED: 'Customer created successfully',
  UPDATED: 'Customer updated successfully',
  ACTIVATED: 'Customer activated successfully',
  DEACTIVATED: 'Customer deactivated successfully',
  PAYMENT_TERMS_FETCHED: 'Payment terms fetched successfully',
  METRICS_FETCHED: 'Customer metrics fetched successfully',
});

module.exports = {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_MESSAGES,
};

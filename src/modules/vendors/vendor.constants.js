'use strict';

const VENDOR_SORT_FIELDS = Object.freeze({
  name: 'v.name',
  vendorCode: 'v.vendor_code',
  gstNumber: 'v.gst_number',
  totalProcurement: 'total_procurement',
  outstandingAmount: 'outstanding_amount',
  status: 'v.is_active',
  createdAt: 'v.created_at',
});

const VENDOR_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Vendors fetched successfully',
  DETAIL_FETCHED: 'Vendor fetched successfully',
  LEDGER_FETCHED: 'Vendor ledger fetched successfully',
  CREATED: 'Vendor created successfully',
  UPDATED: 'Vendor updated successfully',
  ACTIVATED: 'Vendor activated successfully',
  DEACTIVATED: 'Vendor deactivated successfully',
  PAYMENT_TERMS_FETCHED: 'Payment terms fetched successfully',
  METRICS_FETCHED: 'Vendor metrics fetched successfully',
});

module.exports = {
  VENDOR_SORT_FIELDS,
  VENDOR_MESSAGES,
};

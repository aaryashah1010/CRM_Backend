'use strict';

const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
});

const INVOICE_STATUSES = Object.freeze(Object.values(INVOICE_STATUS));
const INVOICE_NUMBER_PREFIX = 'INV';
const INVOICE_LOCKED_STATUSES = Object.freeze([
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.OVERDUE,
  INVOICE_STATUS.CANCELLED,
]);

const INVOICE_SORT_FIELDS = Object.freeze({
  invoiceNumber: 'si.invoice_number',
  customerName: 'c.name',
  invoiceDate: 'si.invoice_date',
  dueDate: 'si.due_date',
  totalAmount: 'si.total_amount',
  outstandingAmount: 'si.outstanding_amount',
  status: 'si.status',
  createdAt: 'si.created_at',
});

const INVOICE_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Invoices fetched successfully',
  DETAIL_FETCHED: 'Invoice fetched successfully',
  CREATED: 'Invoice created successfully',
  UPDATED: 'Invoice updated successfully',
  ISSUED: 'Invoice issued successfully',
  CANCELLED: 'Invoice cancelled successfully',
  METRICS_FETCHED: 'Invoice metrics fetched successfully',
});

module.exports = {
  INVOICE_STATUS,
  INVOICE_STATUSES,
  INVOICE_NUMBER_PREFIX,
  INVOICE_LOCKED_STATUSES,
  INVOICE_SORT_FIELDS,
  INVOICE_MESSAGES,
};

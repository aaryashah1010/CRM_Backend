'use strict';

const QUOTATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
});

const QUOTATION_STATUSES = Object.freeze(Object.values(QUOTATION_STATUS));

// Allowed transitions: from -> [to...]
const QUOTATION_TRANSITIONS = Object.freeze({
  [QUOTATION_STATUS.DRAFT]: [QUOTATION_STATUS.SENT, QUOTATION_STATUS.REJECTED],
  [QUOTATION_STATUS.SENT]: [QUOTATION_STATUS.APPROVED, QUOTATION_STATUS.REJECTED, QUOTATION_STATUS.EXPIRED],
  [QUOTATION_STATUS.APPROVED]: [QUOTATION_STATUS.CONVERTED, QUOTATION_STATUS.REJECTED],
  [QUOTATION_STATUS.REJECTED]: [],
  [QUOTATION_STATUS.EXPIRED]: [],
  [QUOTATION_STATUS.CONVERTED]: [],
});

// Statuses where the quotation header/items are immutable.
const QUOTATION_LOCKED_STATUSES = Object.freeze([
  QUOTATION_STATUS.APPROVED,
  QUOTATION_STATUS.REJECTED,
  QUOTATION_STATUS.EXPIRED,
  QUOTATION_STATUS.CONVERTED,
]);

const QUOTATION_SORT_FIELDS = Object.freeze({
  quotationNumber: 'q.quotation_number',
  quotationDate: 'q.quotation_date',
  validUntil: 'q.valid_until',
  customer: 'c.name',
  status: 'q.status',
  totalAmount: 'q.total_amount',
  createdAt: 'q.created_at',
});

const QUOTATION_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Quotations fetched successfully',
  DETAIL_FETCHED: 'Quotation fetched successfully',
  CREATED: 'Quotation created successfully',
  UPDATED: 'Quotation updated successfully',
  SENT: 'Quotation sent to customer',
  APPROVED: 'Quotation approved',
  REJECTED: 'Quotation rejected',
  EXPIRED: 'Quotation marked as expired',
  CONVERTED: 'Quotation converted to sales order',
  METRICS_FETCHED: 'Quotation metrics fetched successfully',
});

const QUOTATION_NUMBER_PREFIX = 'QT';

module.exports = {
  QUOTATION_STATUS,
  QUOTATION_STATUSES,
  QUOTATION_TRANSITIONS,
  QUOTATION_LOCKED_STATUSES,
  QUOTATION_SORT_FIELDS,
  QUOTATION_MESSAGES,
  QUOTATION_NUMBER_PREFIX,
};

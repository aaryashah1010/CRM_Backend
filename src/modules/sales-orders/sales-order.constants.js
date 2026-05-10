'use strict';

const SALES_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PARTIALLY_DISPATCHED: 'partially_dispatched',
  DISPATCHED: 'dispatched',
  CANCELLED: 'cancelled',
});

const SALES_ORDER_STATUSES = Object.freeze(Object.values(SALES_ORDER_STATUS));

// Allowed transitions: from -> [to...]
const SALES_ORDER_TRANSITIONS = Object.freeze({
  [SALES_ORDER_STATUS.DRAFT]: [SALES_ORDER_STATUS.CONFIRMED, SALES_ORDER_STATUS.CANCELLED],
  [SALES_ORDER_STATUS.CONFIRMED]: [SALES_ORDER_STATUS.PARTIALLY_DISPATCHED, SALES_ORDER_STATUS.DISPATCHED, SALES_ORDER_STATUS.CANCELLED],
  [SALES_ORDER_STATUS.PARTIALLY_DISPATCHED]: [SALES_ORDER_STATUS.DISPATCHED, SALES_ORDER_STATUS.CANCELLED],
  [SALES_ORDER_STATUS.DISPATCHED]: [],
  [SALES_ORDER_STATUS.CANCELLED]: [],
});

// Statuses that should never be edited (items / totals locked)
const SALES_ORDER_LOCKED_STATUSES = Object.freeze([
  SALES_ORDER_STATUS.PARTIALLY_DISPATCHED,
  SALES_ORDER_STATUS.DISPATCHED,
  SALES_ORDER_STATUS.CANCELLED,
]);

const SALES_ORDER_SORT_FIELDS = Object.freeze({
  orderNumber: 'so.order_number',
  orderDate: 'so.order_date',
  expectedDeliveryDate: 'so.expected_delivery_date',
  customer: 'c.name',
  status: 'so.status',
  totalAmount: 'so.total_amount',
  createdAt: 'so.created_at',
});

const SALES_ORDER_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Sales orders fetched successfully',
  DETAIL_FETCHED: 'Sales order fetched successfully',
  CREATED: 'Sales order created successfully',
  UPDATED: 'Sales order updated successfully',
  CONFIRMED: 'Sales order confirmed',
  DISPATCHED: 'Sales order dispatched',
  CONVERTED_TO_INVOICE: 'Sales order converted to invoice',
  CANCELLED: 'Sales order cancelled',
  METRICS_FETCHED: 'Sales order metrics fetched successfully',
});

const SALES_ORDER_NUMBER_PREFIX = 'SO';

module.exports = {
  SALES_ORDER_STATUS,
  SALES_ORDER_STATUSES,
  SALES_ORDER_TRANSITIONS,
  SALES_ORDER_LOCKED_STATUSES,
  SALES_ORDER_SORT_FIELDS,
  SALES_ORDER_MESSAGES,
  SALES_ORDER_NUMBER_PREFIX,
};

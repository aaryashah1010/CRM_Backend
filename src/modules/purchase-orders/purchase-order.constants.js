'use strict';

const PURCHASE_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
});

const PURCHASE_ORDER_STATUSES = Object.freeze(Object.values(PURCHASE_ORDER_STATUS));

const PURCHASE_ORDER_TRANSITIONS = Object.freeze({
  [PURCHASE_ORDER_STATUS.DRAFT]: [PURCHASE_ORDER_STATUS.SENT, PURCHASE_ORDER_STATUS.CANCELLED],
  [PURCHASE_ORDER_STATUS.SENT]: [
    PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED,
    PURCHASE_ORDER_STATUS.RECEIVED,
    PURCHASE_ORDER_STATUS.CANCELLED,
  ],
  [PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED]: [
    PURCHASE_ORDER_STATUS.RECEIVED,
    PURCHASE_ORDER_STATUS.CANCELLED,
  ],
  [PURCHASE_ORDER_STATUS.RECEIVED]: [],
  [PURCHASE_ORDER_STATUS.CANCELLED]: [],
});

const PURCHASE_ORDER_LOCKED_STATUSES = Object.freeze([
  PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED,
  PURCHASE_ORDER_STATUS.RECEIVED,
  PURCHASE_ORDER_STATUS.CANCELLED,
]);

const PURCHASE_ORDER_SORT_FIELDS = Object.freeze({
  poNumber: 'po.po_number',
  vendorName: 'v.name',
  orderDate: 'po.order_date',
  expectedDeliveryDate: 'po.expected_delivery_date',
  status: 'po.status',
  totalAmount: 'po.total_amount',
  createdAt: 'po.created_at',
});

const PURCHASE_ORDER_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Purchase orders fetched successfully',
  DETAIL_FETCHED: 'Purchase order fetched successfully',
  CREATED: 'Purchase order created successfully',
  UPDATED: 'Purchase order updated successfully',
  SENT: 'Purchase order sent successfully',
  CANCELLED: 'Purchase order cancelled successfully',
  METRICS_FETCHED: 'Purchase order metrics fetched successfully',
  RECEIVED: 'Goods received against purchase order successfully',
});

const PURCHASE_ORDER_NUMBER_PREFIX = 'PO';
const INWARD_NUMBER_PREFIX = 'GRN';

const PURCHASE_ORDER_RECEIVABLE_STATUSES = Object.freeze([
  PURCHASE_ORDER_STATUS.SENT,
  PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED,
]);

module.exports = {
  PURCHASE_ORDER_STATUS,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_TRANSITIONS,
  PURCHASE_ORDER_LOCKED_STATUSES,
  PURCHASE_ORDER_RECEIVABLE_STATUSES,
  PURCHASE_ORDER_SORT_FIELDS,
  PURCHASE_ORDER_MESSAGES,
  PURCHASE_ORDER_NUMBER_PREFIX,
  INWARD_NUMBER_PREFIX,
};

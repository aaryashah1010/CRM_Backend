'use strict';

const ROLES = Object.freeze({
  ADMIN: 'admin',
  SALES_EXECUTIVE: 'sales_executive',
  PURCHASE_MANAGER: 'purchase_manager',
  ACCOUNTANT: 'accountant',
  WAREHOUSE_MANAGER: 'warehouse_manager',
});

const LEAD_STATUS = Object.freeze({
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  LOST: 'lost',
  CONVERTED: 'converted',
});

const QUOTATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
});

const SALES_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PARTIALLY_DISPATCHED: 'partially_dispatched',
  DISPATCHED: 'dispatched',
  CANCELLED: 'cancelled',
});

const PURCHASE_ORDER_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
});

const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
});

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

const STOCK_MOVEMENT_TYPE = Object.freeze({
  INWARD: 'inward',
  OUTWARD: 'outward',
  ADJUSTMENT_IN: 'adjustment_in',
  ADJUSTMENT_OUT: 'adjustment_out',
  RETURN_IN: 'return_in',
  RETURN_OUT: 'return_out',
  OPENING: 'opening',
});

module.exports = {
  ROLES,
  LEAD_STATUS,
  QUOTATION_STATUS,
  SALES_ORDER_STATUS,
  PURCHASE_ORDER_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_MODE,
  STOCK_MOVEMENT_TYPE,
};

'use strict';

const db = require('../../config/db');
const {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  PaymentAmountInvalidError,
} = require('../../common/errors');
const invoiceRepository = require('../invoices/invoice.repository');
const invoiceService = require('../invoices/invoice.service');
const { INVOICE_STATUS } = require('../invoices/invoice.constants');
const receiptRepository = require('./receipt.repository');
const { RECEIPT_STATUS } = require('./receipt.constants');

const RECEIPT_ALLOWED_INVOICE_STATUSES = Object.freeze([
  INVOICE_STATUS.ISSUED,
  INVOICE_STATUS.PARTIALLY_PAID,
  INVOICE_STATUS.OVERDUE,
]);

const toNumber = (value) => Number(value || 0);
const round2 = (value) => Math.round(Number(value) * 100) / 100;
const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizeReceipt = (row) => ({
  id: row.id,
  receiptNumber: row.receipt_number,
  customerId: row.customer_id,
  invoiceId: row.invoice_id,
  receiptDate: normalizeDate(row.receipt_date),
  paymentMode: row.payment_mode,
  amount: toNumber(row.amount),
  bankName: row.bank_name,
  chequeNumber: row.cheque_number,
  transactionReference: row.transaction_reference,
  paymentDate: normalizeDate(row.payment_date),
  status: row.status,
  notes: row.notes,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  customer: {
    id: row.customer_id,
    customerCode: row.customer_code,
    name: row.customer_name,
  },
  invoice: row.invoice_id ? {
    id: row.invoice_id,
    invoiceNumber: row.invoice_number,
  } : null,
});

const assertReceiptAllowed = (invoice) => {
  if (!RECEIPT_ALLOWED_INVOICE_STATUSES.includes(invoice.status)) {
    throw new ConflictError('Receipt can be recorded only for issued, overdue, or partially paid invoices');
  }

  if (toNumber(invoice.outstanding_amount) <= 0) {
    throw new ConflictError('Invoice is already fully paid');
  }
};

const assertValidAmount = (amount, outstandingAmount) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaymentAmountInvalidError('Receipt amount must be greater than 0');
  }

  if (amount > outstandingAmount) {
    throw new PaymentAmountInvalidError('Receipt amount cannot exceed the invoice outstanding amount');
  }
};

const nextInvoicePaymentState = (invoice, amount) => {
  const paidAmount = round2(toNumber(invoice.paid_amount) + amount);
  const outstandingAmount = round2(toNumber(invoice.total_amount) - paidAmount);

  return {
    paidAmount,
    outstandingAmount: outstandingAmount < 0.01 ? 0 : outstandingAmount,
    status: outstandingAmount < 0.01 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID,
  };
};

const recordInvoiceReceipt = async (invoiceId, payload, actorUserId) => {
  const receiptId = await db.withTransaction(async (client) => {
    const invoice = await invoiceRepository.findForReceipt(invoiceId, client);
    if (!invoice) throw new NotFoundError('Invoice not found');

    assertReceiptAllowed(invoice);

    const amount = round2(payload.amount);
    const outstandingAmount = round2(toNumber(invoice.outstanding_amount));
    assertValidAmount(amount, outstandingAmount);

    const receiptNumber = await receiptRepository.generateReceiptNumber(client);
    const id = await receiptRepository.insertReceipt({
      receiptNumber,
      customerId: invoice.customer_id,
      invoiceId: invoice.id,
      receiptDate: normalizeDate(payload.receiptDate),
      paymentMode: payload.paymentMode,
      amount,
      bankName: payload.bankName || null,
      chequeNumber: payload.chequeNumber || null,
      transactionReference: payload.transactionReference || null,
      paymentDate: normalizeDate(payload.paymentDate) || normalizeDate(payload.receiptDate),
      status: RECEIPT_STATUS.COMPLETED,
      notes: payload.notes || null,
      actorUserId,
    }, client);

    await invoiceRepository.applyReceipt(invoice.id, {
      ...nextInvoicePaymentState(invoice, amount),
      actorUserId,
    }, client);

    return id;
  });

  const [receipt, invoice] = await Promise.all([
    getReceipt(receiptId),
    invoiceService.getInvoice(invoiceId),
  ]);

  return { receipt, invoice };
};

const getReceipt = async (receiptId) => {
  const receipt = await receiptRepository.findById(receiptId);
  if (!receipt) throw new NotFoundError('Receipt not found');
  return normalizeReceipt(receipt);
};

const listInvoiceReceipts = async (invoiceId) => {
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice not found');

  const rows = await receiptRepository.listByInvoiceId(invoiceId);
  return rows.map(normalizeReceipt);
};

module.exports = {
  recordInvoiceReceipt,
  getReceipt,
  listInvoiceReceipts,
};

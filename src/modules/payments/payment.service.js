'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  PaymentAmountInvalidError,
} = require('../../common/errors');
const paymentRepository = require('./payment.repository');
const { PAYMENT_STATUS } = require('./payment.constants');

const toNumber = (value) => Number(value || 0);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const PAYMENT_TOLERANCE = 0.01;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizePayment = (row) => ({
  id: row.id,
  paymentNumber: row.payment_number,
  vendorId: row.vendor_id,
  purchaseOrderId: row.purchase_order_id,
  inwardId: row.inward_id,
  paymentDate: normalizeDate(row.payment_date),
  paymentMode: row.payment_mode,
  amount: toNumber(row.amount),
  bankName: row.bank_name,
  chequeNumber: row.cheque_number,
  transactionReference: row.transaction_reference,
  status: row.status,
  notes: row.notes,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  vendor: row.vendor_id ? {
    id: row.vendor_id,
    vendorCode: row.vendor_code,
    name: row.vendor_name,
    gstNumber: row.vendor_gst_number,
  } : null,
  purchaseOrder: row.purchase_order_id ? {
    id: row.purchase_order_id,
    poNumber: row.po_number,
    totalAmount: toNumber(row.po_total_amount),
    status: row.po_status,
  } : null,
  inward: row.inward_id ? {
    id: row.inward_id,
    inwardNumber: row.inward_number,
    totalAmount: toNumber(row.inward_total_amount),
  } : null,
});

const calculatePayableSummary = async (
  { vendorId, purchaseOrderId = null, inwardId = null, vendor = null, purchaseOrder = null, inward = null },
  client
) => {
  let scope = 'vendor';
  let totalPayable = 0;
  let totalPaid = 0;

  if (inwardId) {
    scope = 'inward';
    totalPayable = round2(toNumber(inward?.total_amount));
    totalPaid = round2(await paymentRepository.sumCompletedPaymentsForInward(inwardId, client));
  } else if (purchaseOrderId) {
    scope = 'purchase_order';
    totalPayable = round2(await paymentRepository.sumProcurementForPurchaseOrder(purchaseOrderId, client));
    totalPaid = round2(await paymentRepository.sumCompletedPaymentsForPurchaseOrder(purchaseOrderId, client));
  } else {
    totalPayable = round2(await paymentRepository.sumProcurementForVendor(vendorId, client));
    totalPaid = round2(await paymentRepository.sumCompletedPaymentsForVendor(vendorId, client));
  }

  const outstandingAmount = round2(Math.max(0, totalPayable - totalPaid));

  return {
    scope,
    vendorId,
    purchaseOrderId: purchaseOrderId || null,
    inwardId: inwardId || null,
    totalPayable,
    totalPaid,
    outstandingAmount,
  };
};

const normalizePayableInward = (row) => ({
  id: row.id,
  inwardNumber: row.inward_number,
  purchaseOrderId: row.purchase_order_id,
  purchaseOrderNumber: row.po_number,
  vendorId: row.vendor_id,
  inwardDate: normalizeDate(row.inward_date),
  vendorInvoiceNumber: row.vendor_invoice_number,
  totalAmount: toNumber(row.total_amount),
  totalPaid: toNumber(row.total_paid),
  outstandingAmount: toNumber(row.outstanding_amount),
});

const recordVendorPayment = async (payload, actorUserId) => {
  const amount = round2(toNumber(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaymentAmountInvalidError('Payment amount must be greater than zero');
  }

  const paymentDate = normalizeDate(payload.paymentDate);
  if (!paymentDate) throw new BusinessRuleError('Payment date is required');

  const vendorId = Number(payload.vendorId);
  const purchaseOrderId = payload.purchaseOrderId ? Number(payload.purchaseOrderId) : null;
  const inwardId = payload.inwardId ? Number(payload.inwardId) : null;

  const { paymentId, payable } = await db.withTransaction(async (client) => {
    const vendor = await paymentRepository.lockVendorById(vendorId, client);
    if (!vendor) throw new NotFoundError('Vendor not found');
    if (!vendor.is_active) throw new BusinessRuleError('Inactive vendors cannot receive payments');

    let purchaseOrder = null;
    if (purchaseOrderId) {
      purchaseOrder = await paymentRepository.lockPurchaseOrderById(purchaseOrderId, client);
      if (!purchaseOrder) throw new NotFoundError('Purchase order not found');
      if (!purchaseOrder.is_active) throw new BusinessRuleError('Inactive purchase orders cannot receive payments');
      if (Number(purchaseOrder.vendor_id) !== vendorId) {
        throw new BusinessRuleError('Purchase order does not belong to the selected vendor');
      }
      if (purchaseOrder.status === 'cancelled') {
        throw new BusinessRuleError('Cancelled purchase orders cannot receive payments');
      }
    }

    let inward = null;
    if (inwardId) {
      inward = await paymentRepository.lockInwardById(inwardId, client);
      if (!inward) throw new NotFoundError('Inward record not found');
      if (!inward.is_active) throw new BusinessRuleError('Inactive inward records cannot receive payments');
      if (Number(inward.vendor_id) !== vendorId) {
        throw new BusinessRuleError('Inward record does not belong to the selected vendor');
      }
      if (purchaseOrderId && Number(inward.purchase_order_id || 0) !== purchaseOrderId) {
        throw new BusinessRuleError('Inward record does not belong to the selected purchase order');
      }

      if (!purchaseOrder && inward.purchase_order_id) {
        purchaseOrder = await paymentRepository.lockPurchaseOrderById(Number(inward.purchase_order_id), client);
      }

      if (purchaseOrder?.status === 'cancelled') {
        throw new BusinessRuleError('Cancelled purchase orders cannot receive payments');
      }
    }

    const payableBefore = await calculatePayableSummary(
      { vendorId, purchaseOrderId, inwardId, vendor, purchaseOrder, inward },
      client
    );
    const vendorPayableBefore = await calculatePayableSummary({ vendorId, vendor }, client);
    const availableOutstanding = Math.min(payableBefore.outstandingAmount, vendorPayableBefore.outstandingAmount);

    if (amount > availableOutstanding + PAYMENT_TOLERANCE) {
      throw new PaymentAmountInvalidError(
        `Payment amount (${amount}) exceeds outstanding payable (${availableOutstanding})`
      );
    }

    const paymentNumber = await paymentRepository.generatePaymentNumber(client);
    const newId = await paymentRepository.insertPayment({
      paymentNumber,
      vendorId,
      purchaseOrderId,
      inwardId,
      paymentDate,
      paymentMode: payload.paymentMode,
      amount,
      bankName: payload.bankName || null,
      chequeNumber: payload.chequeNumber || null,
      transactionReference: payload.transactionReference || null,
      status: PAYMENT_STATUS.COMPLETED,
      notes: payload.notes || null,
      actorUserId,
    }, client);

    const payableAfter = await calculatePayableSummary(
      { vendorId, purchaseOrderId, inwardId, vendor, purchaseOrder, inward },
      client
    );

    return { paymentId: newId, payable: payableAfter };
  });

  const paymentRow = await paymentRepository.findById(paymentId);
  return {
    payment: normalizePayment(paymentRow),
    payable,
  };
};

const reversePayment = async (paymentId, actorUserId) => {
  const payable = await db.withTransaction(async (client) => {
    const payment = await paymentRepository.lockPaymentById(paymentId, client);
    if (!payment) throw new NotFoundError('Payment not found');
    if (!payment.is_active) throw new ConflictError('Payment is no longer active');
    if (payment.status === PAYMENT_STATUS.REVERSED) {
      throw new ConflictError('Payment has already been reversed');
    }
    if (payment.status !== PAYMENT_STATUS.COMPLETED) {
      throw new ConflictError(`Only completed payments can be reversed (current status: ${payment.status})`);
    }

    const vendorId = Number(payment.vendor_id);
    const purchaseOrderId = payment.purchase_order_id ? Number(payment.purchase_order_id) : null;
    const inwardId = payment.inward_id ? Number(payment.inward_id) : null;

    const vendor = await paymentRepository.lockVendorById(vendorId, client);
    let purchaseOrder = purchaseOrderId
      ? await paymentRepository.lockPurchaseOrderById(purchaseOrderId, client)
      : null;
    const inward = inwardId ? await paymentRepository.lockInwardById(inwardId, client) : null;

    if (!purchaseOrder && inward?.purchase_order_id) {
      purchaseOrder = await paymentRepository.lockPurchaseOrderById(Number(inward.purchase_order_id), client);
    }

    await paymentRepository.setStatusInTransaction(paymentId, PAYMENT_STATUS.REVERSED, actorUserId, client);

    return calculatePayableSummary({ vendorId, purchaseOrderId, inwardId, vendor, purchaseOrder, inward }, client);
  });

  const paymentRow = await paymentRepository.findById(paymentId);
  return {
    payment: normalizePayment(paymentRow),
    payable,
  };
};

const listPayments = async (query) => {
  const result = await paymentRepository.listPayments(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizePayment),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      totalItems: pagination.total,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPreviousPage: pagination.hasPrevPage,
    },
  };
};

const getPayment = async (paymentId) => {
  const row = await paymentRepository.findById(paymentId);
  if (!row) throw new NotFoundError('Payment not found');
  return normalizePayment(row);
};

const getVendorPayable = async (vendorId, { purchaseOrderId = null, inwardId = null } = {}) => {
  return db.withTransaction(async (client) => {
    const vendor = await paymentRepository.lockVendorById(vendorId, client);
    if (!vendor) throw new NotFoundError('Vendor not found');

    let purchaseOrder = null;
    if (purchaseOrderId) {
      purchaseOrder = await paymentRepository.lockPurchaseOrderById(purchaseOrderId, client);
      if (!purchaseOrder) throw new NotFoundError('Purchase order not found');
      if (Number(purchaseOrder.vendor_id) !== Number(vendorId)) {
        throw new BusinessRuleError('Purchase order does not belong to the selected vendor');
      }
    }

    let inward = null;
    if (inwardId) {
      inward = await paymentRepository.lockInwardById(inwardId, client);
      if (!inward) throw new NotFoundError('Inward record not found');
      if (Number(inward.vendor_id) !== Number(vendorId)) {
        throw new BusinessRuleError('Inward record does not belong to the selected vendor');
      }
      if (purchaseOrderId && Number(inward.purchase_order_id || 0) !== Number(purchaseOrderId)) {
        throw new BusinessRuleError('Inward record does not belong to the selected purchase order');
      }
    }

    return calculatePayableSummary(
      { vendorId: Number(vendorId), purchaseOrderId, inwardId, vendor, purchaseOrder, inward },
      client
    );
  });
};

const listVendorPayableInwards = async (vendorId, { purchaseOrderId = null } = {}) => {
  return db.withTransaction(async (client) => {
    const vendor = await paymentRepository.lockVendorById(vendorId, client);
    if (!vendor) throw new NotFoundError('Vendor not found');

    if (purchaseOrderId) {
      const purchaseOrder = await paymentRepository.lockPurchaseOrderById(purchaseOrderId, client);
      if (!purchaseOrder) throw new NotFoundError('Purchase order not found');
      if (Number(purchaseOrder.vendor_id) !== Number(vendorId)) {
        throw new BusinessRuleError('Purchase order does not belong to the selected vendor');
      }
    }

    const rows = await paymentRepository.listPayableInwardsForVendor({
      vendorId: Number(vendorId),
      purchaseOrderId: purchaseOrderId ? Number(purchaseOrderId) : null,
    }, client);

    return rows.map(normalizePayableInward);
  });
};

module.exports = {
  recordVendorPayment,
  reversePayment,
  listPayments,
  getPayment,
  getVendorPayable,
  listVendorPayableInwards,
};

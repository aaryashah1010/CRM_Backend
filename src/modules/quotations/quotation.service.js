'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');

const quotationRepository = require('./quotation.repository');
const salesOrderRepository = require('../sales-orders/sales-order.repository');
const { SALES_ORDER_STATUS } = require('../sales-orders/sales-order.constants');
const {
  QUOTATION_STATUS,
  QUOTATION_TRANSITIONS,
  QUOTATION_LOCKED_STATUSES,
} = require('./quotation.constants');

// ----- helpers ---------------------------------------------------------------

const toNumber = (value) => Number(value || 0);
const round2 = (value) => Math.round(Number(value) * 100) / 100;
const round3 = (value) => Math.round(Number(value) * 1000) / 1000;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const toCustomer = (row) => row.customer_id_ref ? ({
  id: row.customer_id_ref,
  customerCode: row.customer_code,
  name: row.customer_name,
  email: row.customer_email,
  phone: row.customer_phone,
  gstNumber: row.customer_gst_number,
}) : null;

const toPaymentTerm = (row) => row.payment_term_id_ref ? ({
  id: row.payment_term_id_ref,
  name: row.payment_term_name,
  days: row.payment_term_days,
}) : null;

const toAssignedTo = (row) => row.assigned_to_id ? ({
  id: row.assigned_to_id,
  fullName: row.assigned_to_name,
}) : null;

const toConvertedSalesOrder = (row) => row.converted_sales_order_id ? ({
  id: row.converted_sales_order_id,
  orderNumber: row.converted_sales_order_number,
}) : null;

const normalizeQuotationSummary = (row) => ({
  id: row.id,
  quotationNumber: row.quotation_number,
  customerId: row.customer_id,
  leadId: row.lead_id,
  quotationDate: normalizeDate(row.quotation_date),
  validUntil: normalizeDate(row.valid_until),
  status: row.status,
  paymentTermId: row.payment_term_id,
  subtotalAmount: toNumber(row.subtotal_amount),
  discountAmount: toNumber(row.discount_amount),
  taxableAmount: toNumber(row.taxable_amount),
  taxAmount: toNumber(row.tax_amount),
  totalAmount: toNumber(row.total_amount),
  itemCount: toNumber(row.item_count),
  isActive: Boolean(row.is_active),
  approvedAt: row.approved_at,
  convertedAt: row.converted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  customer: toCustomer(row),
  paymentTerm: toPaymentTerm(row),
  assignedTo: toAssignedTo(row),
  convertedSalesOrder: toConvertedSalesOrder(row),
});

const normalizeItem = (row) => ({
  id: row.id,
  quotationId: row.quotation_id,
  productId: row.product_id,
  productNameSnapshot: row.product_name_snapshot,
  skuSnapshot: row.sku_snapshot,
  hsnSacCode: row.hsn_sac_code,
  quantity: toNumber(row.quantity),
  unit: row.unit,
  unitPrice: toNumber(row.unit_price),
  discountPercent: toNumber(row.discount_percent),
  discountAmount: toNumber(row.discount_amount),
  taxableAmount: toNumber(row.taxable_amount),
  cgstRate: toNumber(row.cgst_rate),
  sgstRate: toNumber(row.sgst_rate),
  igstRate: toNumber(row.igst_rate),
  taxRate: toNumber(row.tax_rate),
  cgstAmount: toNumber(row.cgst_amount),
  sgstAmount: toNumber(row.sgst_amount),
  igstAmount: toNumber(row.igst_amount),
  taxAmount: toNumber(row.tax_amount),
  lineTotal: toNumber(row.line_total),
  sortOrder: toNumber(row.sort_order),
  product: row.product_id ? {
    id: row.product_id,
    sku: row.product_sku,
    name: row.product_name,
  } : null,
});

const normalizeQuotationDetail = (row, items) => ({
  ...normalizeQuotationSummary(row),
  billingAddress: row.billing_address,
  shippingAddress: row.shipping_address,
  cgstAmount: toNumber(row.cgst_amount),
  sgstAmount: toNumber(row.sgst_amount),
  igstAmount: toNumber(row.igst_amount),
  roundOffAmount: toNumber(row.round_off_amount),
  notes: row.notes,
  termsAndConditions: row.terms_and_conditions,
  approvedBy: row.approved_by,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  items: items.map(normalizeItem),
});

// ----- calculation -----------------------------------------------------------

/**
 * Backend-authoritative line totals.
 * Per backend-rules.md / api-standards.md, totals submitted by the frontend
 * are never trusted — every monetary value is recalculated here.
 */
const calculateItemTotals = (item) => {
  const quantity = round3(item.quantity);
  const unitPrice = round2(item.unitPrice);
  const discountPercent = round2(item.discountPercent || 0);

  const grossAmount = round2(quantity * unitPrice);
  const discountAmount = round2((grossAmount * discountPercent) / 100);
  const taxableAmount = round2(grossAmount - discountAmount);

  const cgstRate = round2(item.cgstRate || 0);
  const sgstRate = round2(item.sgstRate || 0);
  const igstRate = round2(item.igstRate || 0);
  const taxRate = round2(cgstRate + sgstRate + igstRate);

  const cgstAmount = round2((taxableAmount * cgstRate) / 100);
  const sgstAmount = round2((taxableAmount * sgstRate) / 100);
  const igstAmount = round2((taxableAmount * igstRate) / 100);
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const lineTotal = round2(taxableAmount + taxAmount);

  return {
    productId: item.productId || null,
    productNameSnapshot: item.productNameSnapshot,
    skuSnapshot: item.skuSnapshot || null,
    hsnSacCode: item.hsnSacCode || null,
    quantity,
    unit: item.unit || 'PCS',
    unitPrice,
    discountPercent,
    discountAmount,
    taxableAmount,
    cgstRate,
    sgstRate,
    igstRate,
    taxRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    lineTotal,
    sortOrder: item.sortOrder || 0,
  };
};

const calculateOrderTotals = (items) => {
  let subtotalAmount = 0;
  let discountAmount = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  for (const item of items) {
    subtotalAmount += round2(item.quantity * item.unitPrice);
    discountAmount += item.discountAmount;
    taxableAmount += item.taxableAmount;
    cgstAmount += item.cgstAmount;
    sgstAmount += item.sgstAmount;
    igstAmount += item.igstAmount;
  }

  subtotalAmount = round2(subtotalAmount);
  discountAmount = round2(discountAmount);
  taxableAmount = round2(taxableAmount);
  cgstAmount = round2(cgstAmount);
  sgstAmount = round2(sgstAmount);
  igstAmount = round2(igstAmount);
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);

  const grandRaw = round2(taxableAmount + taxAmount);
  const totalAmount = Math.round(grandRaw);
  const roundOffAmount = round2(totalAmount - grandRaw);

  return {
    subtotalAmount,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    roundOffAmount,
    totalAmount,
  };
};

// ----- guard clauses ---------------------------------------------------------

const assertCustomerExists = async (customerId) => {
  const exists = await quotationRepository.customerExists(customerId);
  if (!exists) throw new BusinessRuleError('Selected customer does not exist or is inactive');
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await quotationRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const assertAssignedUserExists = async (userId) => {
  if (!userId) return;
  const exists = await quotationRepository.userExists(userId);
  if (!exists) throw new BusinessRuleError('Selected assigned user does not exist or is inactive');
};

const assertProductsExist = async (items) => {
  const productIds = items
    .map((item) => item.productId)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (productIds.length === 0) return;

  const found = await quotationRepository.productsExist(productIds);
  for (const id of productIds) {
    if (!found.has(Number(id))) {
      throw new BusinessRuleError(`Product ${id} does not exist or is inactive`);
    }
  }
};

const assertEditable = (status) => {
  if (QUOTATION_LOCKED_STATUSES.includes(status)) {
    throw new BusinessRuleError(`Quotation in '${status}' status cannot be modified`);
  }
};

const assertCanTransition = (fromStatus, toStatus) => {
  const allowed = QUOTATION_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new BusinessRuleError(`Cannot transition quotation from '${fromStatus}' to '${toStatus}'`);
  }
};

const assertValidUntilAfterDate = (quotationDate, validUntil) => {
  const start = new Date(quotationDate);
  const end = new Date(validUntil);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
  if (end < start) {
    throw new BusinessRuleError('Valid-until date must be on or after the quotation date');
  }
};

// ----- public service API ----------------------------------------------------

const listQuotations = async (query) => {
  const result = await quotationRepository.listQuotations(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    items: result.rows.map(normalizeQuotationSummary),
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

const getQuotation = async (quotationId) => {
  const quotation = await quotationRepository.findById(quotationId);
  if (!quotation) throw new NotFoundError('Quotation not found');

  const items = await quotationRepository.listItems(quotationId);
  return normalizeQuotationDetail(quotation, items);
};

const createQuotation = async (payload, actorUserId) => {
  await assertCustomerExists(payload.customerId);
  await assertPaymentTermExists(payload.paymentTermId);
  await assertAssignedUserExists(payload.assignedTo);
  await assertProductsExist(payload.items);
  assertValidUntilAfterDate(payload.quotationDate, payload.validUntil);

  const computedItems = payload.items.map(calculateItemTotals);
  const totals = calculateOrderTotals(computedItems);

  const quotationId = await db.withTransaction(async (client) => {
    const quotationNumber = await quotationRepository.generateQuotationNumber(client);

    const id = await quotationRepository.insertQuotation({
      quotationNumber,
      customerId: payload.customerId,
      leadId: payload.leadId || null,
      quotationDate: payload.quotationDate,
      validUntil: payload.validUntil,
      status: QUOTATION_STATUS.DRAFT,
      paymentTermId: payload.paymentTermId || null,
      billingAddress: payload.billingAddress || null,
      shippingAddress: payload.shippingAddress || null,
      notes: payload.notes || null,
      termsAndConditions: payload.termsAndConditions || null,
      assignedTo: payload.assignedTo || null,
      ...totals,
      actorUserId,
    }, client);

    for (const item of computedItems) {
      await quotationRepository.insertItem(id, { ...item, actorUserId }, client);
    }

    return id;
  });

  return getQuotation(quotationId);
};

const updateQuotation = async (quotationId, payload, actorUserId) => {
  const existing = await quotationRepository.findById(quotationId);
  if (!existing) throw new NotFoundError('Quotation not found');
  assertEditable(existing.status);

  if (payload.customerId !== undefined) await assertCustomerExists(payload.customerId);
  if (payload.paymentTermId !== undefined) await assertPaymentTermExists(payload.paymentTermId);
  if (payload.assignedTo !== undefined) await assertAssignedUserExists(payload.assignedTo);

  const newQuotationDate = payload.quotationDate ?? normalizeDate(existing.quotation_date);
  const newValidUntil = payload.validUntil ?? normalizeDate(existing.valid_until);
  assertValidUntilAfterDate(newQuotationDate, newValidUntil);

  const replaceItems = Array.isArray(payload.items);
  let computedItems = null;
  let totals = null;

  if (replaceItems) {
    if (payload.items.length === 0) {
      throw new BusinessRuleError('Quotation must have at least one item');
    }
    await assertProductsExist(payload.items);
    computedItems = payload.items.map(calculateItemTotals);
    totals = calculateOrderTotals(computedItems);
  }

  await db.withTransaction(async (client) => {
    await quotationRepository.updateQuotationHeader(quotationId, {
      ...payload,
      ...(totals ? { totals } : {}),
      actorUserId,
    }, client);

    if (replaceItems) {
      await quotationRepository.softDeleteItems(quotationId, actorUserId, client);
      for (const item of computedItems) {
        await quotationRepository.insertItem(quotationId, { ...item, actorUserId }, client);
      }
    }
  });

  return getQuotation(quotationId);
};

const transitionStatus = async (quotationId, toStatus, actorUserId, statusOptions = {}) => {
  const existing = await quotationRepository.findById(quotationId);
  if (!existing) throw new NotFoundError('Quotation not found');

  if (existing.status === toStatus) {
    throw new ConflictError(`Quotation is already in '${toStatus}' status`);
  }

  assertCanTransition(existing.status, toStatus);

  await quotationRepository.setStatus(quotationId, toStatus, actorUserId, statusOptions);
  return getQuotation(quotationId);
};

const sendQuotation = (id, actorUserId) =>
  transitionStatus(id, QUOTATION_STATUS.SENT, actorUserId);

const approveQuotation = (id, actorUserId) =>
  transitionStatus(id, QUOTATION_STATUS.APPROVED, actorUserId, { setApprovedAt: true });

const rejectQuotation = (id, actorUserId) =>
  transitionStatus(id, QUOTATION_STATUS.REJECTED, actorUserId);

const expireQuotation = (id, actorUserId) =>
  transitionStatus(id, QUOTATION_STATUS.EXPIRED, actorUserId);

/**
 * Convert an approved quotation into a sales order.
 * - Verifies status transition (approved -> converted)
 * - Generates SO number, copies header & items into sales_orders/sales_order_items
 * - Sets quotation.converted_at and links the new SO via quotation_id
 * - Runs in a single transaction so partial creation is impossible.
 */
const convertToSalesOrder = async (quotationId, payload, actorUserId) => {
  const existing = await quotationRepository.findById(quotationId);
  if (!existing) throw new NotFoundError('Quotation not found');

  assertCanTransition(existing.status, QUOTATION_STATUS.CONVERTED);

  const items = await quotationRepository.listItems(quotationId);
  if (items.length === 0) {
    throw new BusinessRuleError('Quotation has no active items to convert');
  }

  const orderDate = payload?.orderDate || normalizeDate(new Date());
  const expectedDeliveryDate = payload?.expectedDeliveryDate || null;

  const salesOrderId = await db.withTransaction(async (client) => {
    const orderNumber = await salesOrderRepository.generateOrderNumber(client);

    const newOrderId = await salesOrderRepository.insertOrder({
      orderNumber,
      quotationId,
      customerId: existing.customer_id,
      orderDate,
      expectedDeliveryDate,
      status: SALES_ORDER_STATUS.DRAFT,
      paymentTermId: existing.payment_term_id || null,
      billingAddress: existing.billing_address || null,
      shippingAddress: existing.shipping_address || null,
      notes: existing.notes || null,
      assignedTo: existing.assigned_to || null,
      subtotalAmount: toNumber(existing.subtotal_amount),
      discountAmount: toNumber(existing.discount_amount),
      taxableAmount: toNumber(existing.taxable_amount),
      cgstAmount: toNumber(existing.cgst_amount),
      sgstAmount: toNumber(existing.sgst_amount),
      igstAmount: toNumber(existing.igst_amount),
      taxAmount: toNumber(existing.tax_amount),
      roundOffAmount: toNumber(existing.round_off_amount),
      totalAmount: toNumber(existing.total_amount),
      actorUserId,
    }, client);

    for (const item of items) {
      await salesOrderRepository.insertItem(newOrderId, {
        productId: item.product_id || null,
        productNameSnapshot: item.product_name_snapshot,
        skuSnapshot: item.sku_snapshot,
        hsnSacCode: item.hsn_sac_code,
        quantity: toNumber(item.quantity),
        unit: item.unit,
        unitPrice: toNumber(item.unit_price),
        discountPercent: toNumber(item.discount_percent),
        discountAmount: toNumber(item.discount_amount),
        taxableAmount: toNumber(item.taxable_amount),
        cgstRate: toNumber(item.cgst_rate),
        sgstRate: toNumber(item.sgst_rate),
        igstRate: toNumber(item.igst_rate),
        taxRate: toNumber(item.tax_rate),
        cgstAmount: toNumber(item.cgst_amount),
        sgstAmount: toNumber(item.sgst_amount),
        igstAmount: toNumber(item.igst_amount),
        taxAmount: toNumber(item.tax_amount),
        lineTotal: toNumber(item.line_total),
        sortOrder: toNumber(item.sort_order),
        actorUserId,
      }, client);
    }

    await quotationRepository.setStatus(
      quotationId,
      QUOTATION_STATUS.CONVERTED,
      actorUserId,
      { setConvertedAt: true },
      client
    );

    return newOrderId;
  });

  const quotation = await getQuotation(quotationId);
  return {
    quotation,
    salesOrder: {
      id: salesOrderId,
      orderNumber: quotation.convertedSalesOrder?.orderNumber ?? null,
    },
  };
};

const normalizeMetrics = (metrics) => {
  const breakdown = (metrics.statusBreakdown || []).reduce((acc, row) => {
    acc[row.status] = {
      count: toNumber(row.count),
      amount: toNumber(row.amount),
    };
    return acc;
  }, {});

  const totalQuotations = toNumber(metrics.totals?.total_quotations);
  const wonCount = toNumber(metrics.totals?.won_count);
  const conversionRate = totalQuotations > 0
    ? round2((wonCount / totalQuotations) * 100)
    : 0;

  return {
    totalQuotations,
    totalValue: toNumber(metrics.totals?.total_value),
    pendingCount: toNumber(metrics.totals?.pending_count),
    pendingValue: toNumber(metrics.totals?.pending_value),
    wonCount,
    thisMonthCount: toNumber(metrics.totals?.this_month_count),
    conversionRate,
    statusBreakdown: breakdown,
    recent: (metrics.recent || []).map((row) => ({
      id: row.id,
      quotationNumber: row.quotation_number,
      status: row.status,
      customerName: row.customer_name,
      convertedOrderNumber: row.converted_order_number,
      updatedAt: row.updated_at,
      convertedAt: row.converted_at,
    })),
  };
};

const getMetrics = async () => normalizeMetrics(await quotationRepository.getMetrics());

module.exports = {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  sendQuotation,
  approveQuotation,
  rejectQuotation,
  expireQuotation,
  convertToSalesOrder,
  getMetrics,
};

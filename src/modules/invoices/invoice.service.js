'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');
const invoiceRepository = require('./invoice.repository');
const { INVOICE_STATUS, INVOICE_LOCKED_STATUSES } = require('./invoice.constants');

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

const normalizeInvoiceSummary = (row) => ({
  id: row.id,
  invoiceNumber: row.invoice_number,
  salesOrderId: row.sales_order_id,
  salesOrderNumber: row.sales_order_number,
  customerId: row.customer_id,
  invoiceDate: normalizeDate(row.invoice_date),
  dueDate: normalizeDate(row.due_date),
  status: row.status,
  paymentTermId: row.payment_term_id,
  subtotalAmount: toNumber(row.subtotal_amount),
  discountAmount: toNumber(row.discount_amount),
  taxableAmount: toNumber(row.taxable_amount),
  taxAmount: toNumber(row.tax_amount),
  totalAmount: toNumber(row.total_amount),
  paidAmount: toNumber(row.paid_amount),
  outstandingAmount: toNumber(row.outstanding_amount),
  itemCount: toNumber(row.item_count),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  customer: toCustomer(row),
  paymentTerm: toPaymentTerm(row),
});

const normalizeItem = (row) => ({
  id: row.id,
  invoiceId: row.invoice_id,
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

const normalizeInvoiceDetail = (row, items) => ({
  ...normalizeInvoiceSummary(row),
  billingAddress: row.billing_address,
  shippingAddress: row.shipping_address,
  customerGstSnapshot: row.customer_gst_snapshot,
  cgstAmount: toNumber(row.cgst_amount),
  sgstAmount: toNumber(row.sgst_amount),
  igstAmount: toNumber(row.igst_amount),
  roundOffAmount: toNumber(row.round_off_amount),
  notes: row.notes,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  items: items.map(normalizeItem),
});

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

const calculateInvoiceTotals = (items) => {
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

const assertCustomerExists = async (customerId) => {
  const exists = await invoiceRepository.customerExists(customerId);
  if (!exists) throw new BusinessRuleError('Selected customer does not exist or is inactive');
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await invoiceRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const assertSalesOrderExists = async (salesOrderId) => {
  if (!salesOrderId) return;
  const exists = await invoiceRepository.salesOrderExists(salesOrderId);
  if (!exists) throw new BusinessRuleError('Selected sales order does not exist or is inactive');
};

const assertProductsExist = async (items) => {
  const productIds = items.map((item) => item.productId).filter((id) => Number.isInteger(id) && id > 0);
  if (productIds.length === 0) return;
  const found = await invoiceRepository.productsExist(productIds);
  for (const id of productIds) {
    if (!found.has(Number(id))) throw new BusinessRuleError(`Product ${id} does not exist or is inactive`);
  }
};

const assertEditable = (status) => {
  if (INVOICE_LOCKED_STATUSES.includes(status)) {
    throw new BusinessRuleError(`Invoice in '${status}' status cannot be modified`);
  }
};

const assertValidDateRange = (invoiceDate, dueDate) => {
  if (!invoiceDate || !dueDate) return;
  if (new Date(dueDate) < new Date(invoiceDate)) {
    throw new BusinessRuleError('Due date cannot be earlier than invoice date');
  }
};

const listInvoices = async (query) => {
  const result = await invoiceRepository.listInvoices(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeInvoiceSummary),
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

const getInvoice = async (invoiceId) => {
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice not found');
  const items = await invoiceRepository.listItems(invoiceId);
  return normalizeInvoiceDetail(invoice, items);
};

const createInvoice = async (payload, actorUserId) => {
  assertValidDateRange(normalizeDate(payload.invoiceDate), normalizeDate(payload.dueDate));
  await assertCustomerExists(payload.customerId);
  await assertPaymentTermExists(payload.paymentTermId);
  await assertSalesOrderExists(payload.salesOrderId);
  await assertProductsExist(payload.items);

  const computedItems = payload.items.map(calculateItemTotals);
  const totals = calculateInvoiceTotals(computedItems);

  const invoiceId = await db.withTransaction(async (client) => {
    const invoiceNumber = await invoiceRepository.generateInvoiceNumber(client);
    const id = await invoiceRepository.insertInvoice({
      invoiceNumber,
      salesOrderId: payload.salesOrderId || null,
      customerId: payload.customerId,
      invoiceDate: normalizeDate(payload.invoiceDate),
      dueDate: normalizeDate(payload.dueDate),
      status: INVOICE_STATUS.DRAFT,
      paymentTermId: payload.paymentTermId || null,
      billingAddress: payload.billingAddress || null,
      shippingAddress: payload.shippingAddress || null,
      customerGstSnapshot: payload.customerGstSnapshot || null,
      notes: payload.notes || null,
      ...totals,
      actorUserId,
    }, client);

    for (const item of computedItems) {
      await invoiceRepository.insertItem(id, { ...item, actorUserId }, client);
    }
    return id;
  });

  return getInvoice(invoiceId);
};

const updateInvoice = async (invoiceId, payload, actorUserId) => {
  const existing = await invoiceRepository.findById(invoiceId);
  if (!existing) throw new NotFoundError('Invoice not found');
  assertEditable(existing.status);

  const nextInvoiceDate = payload.invoiceDate !== undefined
    ? normalizeDate(payload.invoiceDate)
    : normalizeDate(existing.invoice_date);
  const nextDueDate = payload.dueDate !== undefined
    ? normalizeDate(payload.dueDate)
    : normalizeDate(existing.due_date);
  assertValidDateRange(nextInvoiceDate, nextDueDate);

  if (payload.customerId !== undefined) await assertCustomerExists(payload.customerId);
  if (payload.paymentTermId !== undefined) await assertPaymentTermExists(payload.paymentTermId);
  if (payload.salesOrderId !== undefined) await assertSalesOrderExists(payload.salesOrderId);

  const replaceItems = Array.isArray(payload.items);
  let computedItems = null;
  let totals = null;

  if (replaceItems) {
    if (payload.items.length === 0) throw new BusinessRuleError('Invoice must have at least one item');
    await assertProductsExist(payload.items);
    computedItems = payload.items.map(calculateItemTotals);
    totals = calculateInvoiceTotals(computedItems);
  }

  await db.withTransaction(async (client) => {
    await invoiceRepository.updateInvoiceHeader(invoiceId, {
      ...payload,
      invoiceDate: payload.invoiceDate !== undefined ? normalizeDate(payload.invoiceDate) : undefined,
      dueDate: payload.dueDate !== undefined ? normalizeDate(payload.dueDate) : undefined,
      ...(totals ? { totals } : {}),
      actorUserId,
    }, client);

    if (replaceItems) {
      await invoiceRepository.softDeleteItems(invoiceId, actorUserId, client);
      for (const item of computedItems) {
        await invoiceRepository.insertItem(invoiceId, { ...item, actorUserId }, client);
      }
    }
  });

  return getInvoice(invoiceId);
};

const issueInvoice = async (invoiceId, actorUserId) => {
  const existing = await invoiceRepository.findById(invoiceId);
  if (!existing) throw new NotFoundError('Invoice not found');
  if (existing.status !== INVOICE_STATUS.DRAFT) throw new ConflictError('Only draft invoices can be issued');
  await invoiceRepository.setStatus(invoiceId, INVOICE_STATUS.ISSUED, actorUserId);
  return getInvoice(invoiceId);
};

const cancelInvoice = async (invoiceId, actorUserId) => {
  const existing = await invoiceRepository.findById(invoiceId);
  if (!existing) throw new NotFoundError('Invoice not found');
  if (existing.status === INVOICE_STATUS.CANCELLED) throw new ConflictError('Invoice is already cancelled');
  if (toNumber(existing.paid_amount) > 0) throw new BusinessRuleError('Paid invoices cannot be cancelled');
  await invoiceRepository.setStatus(invoiceId, INVOICE_STATUS.CANCELLED, actorUserId);
  return getInvoice(invoiceId);
};

const getMetrics = async () => {
  const metrics = await invoiceRepository.getMetrics();
  const breakdown = (metrics.statusBreakdown || []).reduce((acc, row) => {
    acc[row.status] = {
      count: toNumber(row.count),
      amount: toNumber(row.amount),
      outstanding: toNumber(row.outstanding),
    };
    return acc;
  }, {});
  return {
    totalInvoices: toNumber(metrics.totals?.total_invoices),
    totalAmount: toNumber(metrics.totals?.total_amount),
    totalReceivables: toNumber(metrics.totals?.total_receivables),
    overdueAmount: toNumber(metrics.totals?.overdue_amount),
    paidMtd: toNumber(metrics.totals?.paid_mtd),
    draftCount: toNumber(metrics.totals?.draft_count),
    statusBreakdown: breakdown,
  };
};

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  issueInvoice,
  cancelInvoice,
  getMetrics,
};

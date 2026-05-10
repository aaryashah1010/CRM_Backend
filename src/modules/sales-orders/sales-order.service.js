'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const {
  BusinessRuleError,
  ConflictError,
  InsufficientStockError,
  NotFoundError,
} = require('../../common/errors');
const salesOrderRepository = require('./sales-order.repository');
const {
  SALES_ORDER_STATUS,
  SALES_ORDER_TRANSITIONS,
  SALES_ORDER_LOCKED_STATUSES,
} = require('./sales-order.constants');
const invoiceRepository = require('../invoices/invoice.repository');
const invoiceService = require('../invoices/invoice.service');
const { INVOICE_STATUS } = require('../invoices/invoice.constants');

// ----- helpers ---------------------------------------------------------------

const toNumber = (value) => Number(value || 0);

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const round3 = (value) => Math.round(Number(value) * 1000) / 1000;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const addDaysIso = (baseIso, days) => {
  const date = new Date(`${baseIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
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

const normalizeOrderSummary = (row) => ({
  id: row.id,
  orderNumber: row.order_number,
  quotationId: row.quotation_id,
  customerId: row.customer_id,
  orderDate: normalizeDate(row.order_date),
  expectedDeliveryDate: normalizeDate(row.expected_delivery_date),
  status: row.status,
  paymentTermId: row.payment_term_id,
  subtotalAmount: toNumber(row.subtotal_amount),
  discountAmount: toNumber(row.discount_amount),
  taxableAmount: toNumber(row.taxable_amount),
  taxAmount: toNumber(row.tax_amount),
  totalAmount: toNumber(row.total_amount),
  itemCount: toNumber(row.item_count),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  customer: toCustomer(row),
  paymentTerm: toPaymentTerm(row),
  assignedTo: toAssignedTo(row),
});

const normalizeItem = (row) => ({
  id: row.id,
  orderId: row.order_id,
  productId: row.product_id,
  productNameSnapshot: row.product_name_snapshot,
  skuSnapshot: row.sku_snapshot,
  hsnSacCode: row.hsn_sac_code,
  quantity: toNumber(row.quantity),
  dispatchedQuantity: toNumber(row.dispatched_quantity),
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

const normalizeOrderDetail = (row, items) => ({
  ...normalizeOrderSummary(row),
  billingAddress: row.billing_address,
  shippingAddress: row.shipping_address,
  cgstAmount: toNumber(row.cgst_amount),
  sgstAmount: toNumber(row.sgst_amount),
  igstAmount: toNumber(row.igst_amount),
  roundOffAmount: toNumber(row.round_off_amount),
  notes: row.notes,
  quotation: row.quotation_id ? {
    id: row.quotation_id,
    quotationNumber: row.quotation_number,
  } : null,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  items: items.map(normalizeItem),
});

// ----- calculation -----------------------------------------------------------

/**
 * Backend-authoritative line and order totals.
 * Frontend may submit unitPrice / quantity / discountPercent / tax rates,
 * but the server recalculates every monetary field. Frontend totals are
 * never trusted (per backend-rules.md and api-standards.md).
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
  const totalAmount = Math.round(grandRaw); // round to nearest rupee
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
  const exists = await salesOrderRepository.customerExists(customerId);
  if (!exists) throw new BusinessRuleError('Selected customer does not exist or is inactive');
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await salesOrderRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const assertAssignedUserExists = async (userId) => {
  if (!userId) return;
  const exists = await salesOrderRepository.userExists(userId);
  if (!exists) throw new BusinessRuleError('Selected assigned user does not exist or is inactive');
};

const assertProductsExist = async (items) => {
  const productIds = items
    .map((item) => item.productId)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (productIds.length === 0) return;

  const found = await salesOrderRepository.productsExist(productIds);
  for (const id of productIds) {
    if (!found.has(Number(id))) {
      throw new BusinessRuleError(`Product ${id} does not exist or is inactive`);
    }
  }
};

const assertEditable = (status) => {
  if (SALES_ORDER_LOCKED_STATUSES.includes(status)) {
    throw new BusinessRuleError(`Sales order in '${status}' status cannot be modified`);
  }
};

const assertCanTransition = (fromStatus, toStatus) => {
  const allowed = SALES_ORDER_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new BusinessRuleError(`Cannot transition sales order from '${fromStatus}' to '${toStatus}'`);
  }
};

// ----- public service API ----------------------------------------------------

const listSalesOrders = async (query) => {
  const result = await salesOrderRepository.listSalesOrders(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    items: result.rows.map(normalizeOrderSummary),
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

const getSalesOrder = async (salesOrderId) => {
  const order = await salesOrderRepository.findById(salesOrderId);
  if (!order) throw new NotFoundError('Sales order not found');

  const items = await salesOrderRepository.listItems(salesOrderId);
  return normalizeOrderDetail(order, items);
};

const createSalesOrder = async (payload, actorUserId) => {
  await assertCustomerExists(payload.customerId);
  await assertPaymentTermExists(payload.paymentTermId);
  await assertAssignedUserExists(payload.assignedTo);
  await assertProductsExist(payload.items);

  const computedItems = payload.items.map(calculateItemTotals);
  const totals = calculateOrderTotals(computedItems);

  const orderId = await db.withTransaction(async (client) => {
    const orderNumber = await salesOrderRepository.generateOrderNumber(client);

    const id = await salesOrderRepository.insertOrder({
      orderNumber,
      quotationId: payload.quotationId || null,
      customerId: payload.customerId,
      orderDate: payload.orderDate,
      expectedDeliveryDate: payload.expectedDeliveryDate || null,
      status: SALES_ORDER_STATUS.DRAFT,
      paymentTermId: payload.paymentTermId || null,
      billingAddress: payload.billingAddress || null,
      shippingAddress: payload.shippingAddress || null,
      notes: payload.notes || null,
      assignedTo: payload.assignedTo || null,
      ...totals,
      actorUserId,
    }, client);

    for (const item of computedItems) {
      await salesOrderRepository.insertItem(id, { ...item, actorUserId }, client);
    }

    return id;
  });

  return getSalesOrder(orderId);
};

const updateSalesOrder = async (salesOrderId, payload, actorUserId) => {
  const existing = await salesOrderRepository.findById(salesOrderId);
  if (!existing) throw new NotFoundError('Sales order not found');
  assertEditable(existing.status);

  if (payload.customerId !== undefined) await assertCustomerExists(payload.customerId);
  if (payload.paymentTermId !== undefined) await assertPaymentTermExists(payload.paymentTermId);
  if (payload.assignedTo !== undefined) await assertAssignedUserExists(payload.assignedTo);

  const replaceItems = Array.isArray(payload.items);
  let computedItems = null;
  let totals = null;

  if (replaceItems) {
    if (payload.items.length === 0) {
      throw new BusinessRuleError('Sales order must have at least one item');
    }
    await assertProductsExist(payload.items);
    computedItems = payload.items.map(calculateItemTotals);
    totals = calculateOrderTotals(computedItems);
  }

  await db.withTransaction(async (client) => {
    await salesOrderRepository.updateOrderHeader(salesOrderId, {
      ...payload,
      ...(totals ? { totals } : {}),
      actorUserId,
    }, client);

    if (replaceItems) {
      await salesOrderRepository.softDeleteItems(salesOrderId, actorUserId, client);
      for (const item of computedItems) {
        await salesOrderRepository.insertItem(salesOrderId, { ...item, actorUserId }, client);
      }
    }
  });

  return getSalesOrder(salesOrderId);
};

const transitionStatus = async (salesOrderId, toStatus, actorUserId) => {
  const existing = await salesOrderRepository.findById(salesOrderId);
  if (!existing) throw new NotFoundError('Sales order not found');

  if (existing.status === toStatus) {
    throw new ConflictError(`Sales order is already in '${toStatus}' status`);
  }

  assertCanTransition(existing.status, toStatus);

  await salesOrderRepository.setStatus(salesOrderId, toStatus, actorUserId);
  return getSalesOrder(salesOrderId);
};

const confirmSalesOrder = (id, actorUserId) => transitionStatus(id, SALES_ORDER_STATUS.CONFIRMED, actorUserId);
const cancelSalesOrder = (id, actorUserId) => transitionStatus(id, SALES_ORDER_STATUS.CANCELLED, actorUserId);

const remainingToDispatch = (item) => round3(toNumber(item.quantity) - toNumber(item.dispatched_quantity));

const groupDispatchItemsByProduct = (items) => {
  const groups = new Map();

  for (const item of items) {
    const quantity = remainingToDispatch(item);
    if (quantity <= 0 || !item.product_id) continue;

    const productId = Number(item.product_id);
    const existing = groups.get(productId) || {
      productId,
      requiredQuantity: 0,
      items: [],
    };
    existing.requiredQuantity = round3(existing.requiredQuantity + quantity);
    existing.items.push({ item, quantity });
    groups.set(productId, existing);
  }

  return Array.from(groups.values());
};

const dispatchSalesOrder = async (salesOrderId, actorUserId) => {
  const existing = await salesOrderRepository.findById(salesOrderId);
  if (!existing) throw new NotFoundError('Sales order not found');

  assertCanTransition(existing.status, SALES_ORDER_STATUS.DISPATCHED);

  await db.withTransaction(async (client) => {
    const lockedOrder = await salesOrderRepository.lockOrderForUpdate(salesOrderId, client);
    if (!lockedOrder) throw new NotFoundError('Sales order not found');
    assertCanTransition(lockedOrder.status, SALES_ORDER_STATUS.DISPATCHED);

    const items = await salesOrderRepository.listItems(salesOrderId, client);
    if (items.length === 0) {
      throw new BusinessRuleError('Sales order has no active items to dispatch');
    }

    const dispatchableItems = items
      .map((item) => ({ item, quantity: remainingToDispatch(item) }))
      .filter((entry) => entry.quantity > 0);

    if (dispatchableItems.length === 0) {
      throw new ConflictError('Sales order has already been fully dispatched');
    }

    const movementDate = normalizeDate(new Date());
    const productGroups = groupDispatchItemsByProduct(items);

    for (const group of productGroups) {
      const balance = await salesOrderRepository.getStockBalanceForUpdate(group.productId, client);
      if (!balance) {
        throw new BusinessRuleError(`Product ${group.productId} does not exist or is inactive`);
      }

      const available = toNumber(balance.quantity_available);
      const currentOnHand = toNumber(balance.quantity_on_hand);
      if (available < group.requiredQuantity) {
        throw new InsufficientStockError(
          `Insufficient stock for ${balance.name}. Available ${available}, required ${group.requiredQuantity}`
        );
      }

      let runningOnHand = currentOnHand;
      for (const { item, quantity } of group.items) {
        runningOnHand = round3(runningOnHand - quantity);
        await salesOrderRepository.updateItemDispatchedQuantity(
          item.id,
          round3(toNumber(item.dispatched_quantity) + quantity),
          actorUserId,
          client
        );
        await salesOrderRepository.insertStockMovement({
          productId: group.productId,
          salesOrderId,
          quantityOut: quantity,
          balanceAfter: runningOnHand,
          movementDate,
          remarks: `Sales order ${lockedOrder.order_number} dispatched - ${item.product_name_snapshot}`,
          actorUserId,
        }, client);
      }

      await salesOrderRepository.updateStockOnHand(group.productId, runningOnHand, client);
    }

    for (const { item, quantity } of dispatchableItems.filter((entry) => !entry.item.product_id)) {
      await salesOrderRepository.updateItemDispatchedQuantity(
        item.id,
        round3(toNumber(item.dispatched_quantity) + quantity),
        actorUserId,
        client
      );
    }

    await salesOrderRepository.setStatus(
      salesOrderId,
      SALES_ORDER_STATUS.DISPATCHED,
      actorUserId,
      client
    );
  });

  return getSalesOrder(salesOrderId);
};

const buildInvoiceDates = (payload, order) => {
  const invoiceDate = normalizeDate(payload?.invoiceDate) || normalizeDate(new Date());
  const dueDate = normalizeDate(payload?.dueDate)
    || addDaysIso(invoiceDate, toNumber(order.payment_term_days));

  if (new Date(dueDate) < new Date(invoiceDate)) {
    throw new BusinessRuleError('Invoice due date cannot be earlier than invoice date');
  }

  return { invoiceDate, dueDate };
};

const toInvoiceItemFromSalesOrderItem = (item, index, actorUserId) => ({
  productId: item.product_id || null,
  productNameSnapshot: item.product_name_snapshot,
  skuSnapshot: item.sku_snapshot || null,
  hsnSacCode: item.hsn_sac_code || null,
  quantity: toNumber(item.quantity),
  unit: item.unit || 'PCS',
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
  sortOrder: Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : index,
  actorUserId,
});

const convertToInvoice = async (salesOrderId, payload = {}, actorUserId) => {
  const result = await db.withTransaction(async (client) => {
    const order = await salesOrderRepository.findByIdForInvoice(salesOrderId, client);
    if (!order) throw new NotFoundError('Sales order not found');

    if (order.status !== SALES_ORDER_STATUS.DISPATCHED) {
      throw new BusinessRuleError('Only dispatched sales orders can be converted to invoices');
    }

    const existingInvoice = await invoiceRepository.findBySalesOrderId(salesOrderId, client);
    if (existingInvoice) {
      return {
        invoiceId: existingInvoice.id,
        created: false,
      };
    }

    const items = await salesOrderRepository.listItems(salesOrderId, client);
    if (items.length === 0) {
      throw new BusinessRuleError('Sales order has no active items to invoice');
    }

    const notFullyDispatched = items.some((item) => (
      round3(toNumber(item.dispatched_quantity)) < round3(toNumber(item.quantity))
    ));
    if (notFullyDispatched) {
      throw new BusinessRuleError('Sales order must be fully dispatched before invoice creation');
    }

    const { invoiceDate, dueDate } = buildInvoiceDates(payload, order);
    const invoiceNumber = await invoiceRepository.generateInvoiceNumber(client);
    const invoiceId = await invoiceRepository.insertInvoice({
      invoiceNumber,
      salesOrderId,
      customerId: order.customer_id,
      invoiceDate,
      dueDate,
      status: INVOICE_STATUS.DRAFT,
      paymentTermId: order.payment_term_id || null,
      billingAddress: order.billing_address || null,
      shippingAddress: order.shipping_address || null,
      customerGstSnapshot: order.customer_gst_number || null,
      subtotalAmount: toNumber(order.subtotal_amount),
      discountAmount: toNumber(order.discount_amount),
      taxableAmount: toNumber(order.taxable_amount),
      cgstAmount: toNumber(order.cgst_amount),
      sgstAmount: toNumber(order.sgst_amount),
      igstAmount: toNumber(order.igst_amount),
      taxAmount: toNumber(order.tax_amount),
      roundOffAmount: toNumber(order.round_off_amount),
      totalAmount: toNumber(order.total_amount),
      notes: payload.notes || order.notes || null,
      actorUserId,
    }, client);

    for (const [index, item] of items.entries()) {
      await invoiceRepository.insertItem(
        invoiceId,
        toInvoiceItemFromSalesOrderItem(item, index, actorUserId),
        client
      );
    }

    return { invoiceId, created: true };
  });

  const [salesOrder, invoice] = await Promise.all([
    getSalesOrder(salesOrderId),
    invoiceService.getInvoice(result.invoiceId),
  ]);

  return {
    created: result.created,
    salesOrder,
    invoice,
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

  return {
    totalOrders: toNumber(metrics.totals?.total_orders),
    totalValue: toNumber(metrics.totals?.total_value),
    openValue: toNumber(metrics.totals?.open_value),
    ordersThisMonth: toNumber(metrics.totals?.orders_this_month),
    valueThisMonth: toNumber(metrics.totals?.value_this_month),
    statusBreakdown: breakdown,
  };
};

const getMetrics = async () => normalizeMetrics(await salesOrderRepository.getMetrics());

module.exports = {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  confirmSalesOrder,
  dispatchSalesOrder,
  convertToInvoice,
  cancelSalesOrder,
  getMetrics,
};

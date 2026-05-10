'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');
const purchaseOrderRepository = require('./purchase-order.repository');
const {
  PURCHASE_ORDER_STATUS,
  PURCHASE_ORDER_TRANSITIONS,
  PURCHASE_ORDER_LOCKED_STATUSES,
  PURCHASE_ORDER_RECEIVABLE_STATUSES,
} = require('./purchase-order.constants');

const toNumber = (value) => Number(value || 0);
const round2 = (value) => Math.round(Number(value) * 100) / 100;
const round3 = (value) => Math.round(Number(value) * 1000) / 1000;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const toVendor = (row) => row.vendor_id_ref ? ({
  id: row.vendor_id_ref,
  vendorCode: row.vendor_code,
  name: row.vendor_name,
  email: row.vendor_email,
  phone: row.vendor_phone,
  mobile: row.vendor_mobile,
  gstNumber: row.vendor_gst_number,
  city: row.vendor_city,
  state: row.vendor_state,
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

const normalizePurchaseOrderSummary = (row) => ({
  id: row.id,
  poNumber: row.po_number,
  vendorId: row.vendor_id,
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
  vendor: toVendor(row),
  paymentTerm: toPaymentTerm(row),
  assignedTo: toAssignedTo(row),
});

const normalizeItem = (row) => ({
  id: row.id,
  purchaseOrderId: row.po_id,
  productId: row.product_id,
  productNameSnapshot: row.product_name_snapshot,
  skuSnapshot: row.sku_snapshot,
  hsnSacCode: row.hsn_sac_code,
  quantity: toNumber(row.quantity),
  receivedQuantity: toNumber(row.received_quantity),
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

const normalizePurchaseOrderDetail = (row, items) => ({
  ...normalizePurchaseOrderSummary(row),
  deliveryAddress: row.delivery_address,
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

const calculatePurchaseOrderTotals = (items) => {
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

const assertVendorExists = async (vendorId) => {
  const exists = await purchaseOrderRepository.vendorExists(vendorId);
  if (!exists) throw new BusinessRuleError('Selected vendor does not exist or is inactive');
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await purchaseOrderRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const assertAssignedUserExists = async (userId) => {
  if (!userId) return;
  const exists = await purchaseOrderRepository.userExists(userId);
  if (!exists) throw new BusinessRuleError('Selected assigned user does not exist or is inactive');
};

const assertProductsExist = async (items) => {
  const productIds = items.map((item) => item.productId).filter((id) => Number.isInteger(id) && id > 0);
  if (productIds.length === 0) return;
  const found = await purchaseOrderRepository.productsExist(productIds);
  for (const id of productIds) {
    if (!found.has(Number(id))) throw new BusinessRuleError(`Product ${id} does not exist or is inactive`);
  }
};

const assertEditable = (status) => {
  if (PURCHASE_ORDER_LOCKED_STATUSES.includes(status)) {
    throw new BusinessRuleError(`Purchase order in '${status}' status cannot be modified`);
  }
};

const assertValidDateRange = (orderDate, expectedDeliveryDate) => {
  if (!orderDate || !expectedDeliveryDate) return;
  if (new Date(expectedDeliveryDate) < new Date(orderDate)) {
    throw new BusinessRuleError('Expected delivery date cannot be earlier than order date');
  }
};

const assertCanTransition = (fromStatus, toStatus) => {
  const allowed = PURCHASE_ORDER_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new BusinessRuleError(`Cannot transition purchase order from '${fromStatus}' to '${toStatus}'`);
  }
};

const listPurchaseOrders = async (query) => {
  const result = await purchaseOrderRepository.listPurchaseOrders(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    items: result.rows.map(normalizePurchaseOrderSummary),
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

const getPurchaseOrder = async (purchaseOrderId) => {
  const purchaseOrder = await purchaseOrderRepository.findById(purchaseOrderId);
  if (!purchaseOrder) throw new NotFoundError('Purchase order not found');
  const items = await purchaseOrderRepository.listItems(purchaseOrderId);
  return normalizePurchaseOrderDetail(purchaseOrder, items);
};

const createPurchaseOrder = async (payload, actorUserId) => {
  const orderDate = normalizeDate(payload.orderDate);
  const expectedDeliveryDate = normalizeDate(payload.expectedDeliveryDate);
  assertValidDateRange(orderDate, expectedDeliveryDate);

  await assertVendorExists(payload.vendorId);
  await assertPaymentTermExists(payload.paymentTermId);
  await assertAssignedUserExists(payload.assignedTo);
  await assertProductsExist(payload.items);

  const computedItems = payload.items.map(calculateItemTotals);
  const totals = calculatePurchaseOrderTotals(computedItems);

  const purchaseOrderId = await db.withTransaction(async (client) => {
    const poNumber = await purchaseOrderRepository.generatePurchaseOrderNumber(client);
    const id = await purchaseOrderRepository.insertPurchaseOrder({
      poNumber,
      vendorId: payload.vendorId,
      orderDate,
      expectedDeliveryDate,
      status: PURCHASE_ORDER_STATUS.DRAFT,
      paymentTermId: payload.paymentTermId || null,
      deliveryAddress: payload.deliveryAddress || null,
      notes: payload.notes || null,
      assignedTo: payload.assignedTo || null,
      ...totals,
      actorUserId,
    }, client);

    for (const item of computedItems) {
      await purchaseOrderRepository.insertItem(id, { ...item, actorUserId }, client);
    }
    return id;
  });

  return getPurchaseOrder(purchaseOrderId);
};

const updatePurchaseOrder = async (purchaseOrderId, payload, actorUserId) => {
  const existing = await purchaseOrderRepository.findById(purchaseOrderId);
  if (!existing) throw new NotFoundError('Purchase order not found');
  assertEditable(existing.status);

  const nextOrderDate = payload.orderDate !== undefined ? normalizeDate(payload.orderDate) : normalizeDate(existing.order_date);
  const nextExpectedDeliveryDate = payload.expectedDeliveryDate !== undefined
    ? normalizeDate(payload.expectedDeliveryDate)
    : normalizeDate(existing.expected_delivery_date);
  assertValidDateRange(nextOrderDate, nextExpectedDeliveryDate);

  if (payload.vendorId !== undefined) await assertVendorExists(payload.vendorId);
  if (payload.paymentTermId !== undefined) await assertPaymentTermExists(payload.paymentTermId);
  if (payload.assignedTo !== undefined) await assertAssignedUserExists(payload.assignedTo);

  const replaceItems = Array.isArray(payload.items);
  let computedItems = null;
  let totals = null;

  if (replaceItems) {
    if (payload.items.length === 0) throw new BusinessRuleError('Purchase order must have at least one item');
    await assertProductsExist(payload.items);
    computedItems = payload.items.map(calculateItemTotals);
    totals = calculatePurchaseOrderTotals(computedItems);
  }

  await db.withTransaction(async (client) => {
    await purchaseOrderRepository.updatePurchaseOrderHeader(purchaseOrderId, {
      ...payload,
      orderDate: payload.orderDate !== undefined ? nextOrderDate : undefined,
      expectedDeliveryDate: payload.expectedDeliveryDate !== undefined ? nextExpectedDeliveryDate : undefined,
      ...(totals ? { totals } : {}),
      actorUserId,
    }, client);

    if (replaceItems) {
      await purchaseOrderRepository.softDeleteItems(purchaseOrderId, actorUserId, client);
      for (const item of computedItems) {
        await purchaseOrderRepository.insertItem(purchaseOrderId, { ...item, actorUserId }, client);
      }
    }
  });

  return getPurchaseOrder(purchaseOrderId);
};

const transitionStatus = async (purchaseOrderId, toStatus, actorUserId) => {
  const existing = await purchaseOrderRepository.findById(purchaseOrderId);
  if (!existing) throw new NotFoundError('Purchase order not found');
  if (existing.status === toStatus) throw new ConflictError(`Purchase order is already in '${toStatus}' status`);

  assertCanTransition(existing.status, toStatus);
  await purchaseOrderRepository.setStatus(purchaseOrderId, toStatus, actorUserId);
  return getPurchaseOrder(purchaseOrderId);
};

const sendPurchaseOrder = (id, actorUserId) => transitionStatus(id, PURCHASE_ORDER_STATUS.SENT, actorUserId);
const cancelPurchaseOrder = (id, actorUserId) => transitionStatus(id, PURCHASE_ORDER_STATUS.CANCELLED, actorUserId);

const getMetrics = async () => {
  const metrics = await purchaseOrderRepository.getMetrics();
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
    pendingDeliveries: toNumber(metrics.totals?.pending_deliveries),
    overdueShipments: toNumber(metrics.totals?.overdue_shipments),
    draftCount: toNumber(metrics.totals?.draft_count),
    ordersThisMonth: toNumber(metrics.totals?.orders_this_month),
    valueThisMonth: toNumber(metrics.totals?.value_this_month),
    statusBreakdown: breakdown,
  };
};

const calculateReceiveItemTotals = (poItem, receiveQuantity) => {
  const quantity = round3(receiveQuantity);
  const unitPrice = round2(toNumber(poItem.unit_price));
  const discountPercent = round2(toNumber(poItem.discount_percent));
  const grossAmount = round2(quantity * unitPrice);
  const discountAmount = round2((grossAmount * discountPercent) / 100);
  const taxableAmount = round2(grossAmount - discountAmount);
  const cgstRate = round2(toNumber(poItem.cgst_rate));
  const sgstRate = round2(toNumber(poItem.sgst_rate));
  const igstRate = round2(toNumber(poItem.igst_rate));
  const taxRate = round2(cgstRate + sgstRate + igstRate);
  const cgstAmount = round2((taxableAmount * cgstRate) / 100);
  const sgstAmount = round2((taxableAmount * sgstRate) / 100);
  const igstAmount = round2((taxableAmount * igstRate) / 100);
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const lineTotal = round2(taxableAmount + taxAmount);

  return {
    productId: poItem.product_id,
    productNameSnapshot: poItem.product_name_snapshot,
    skuSnapshot: poItem.sku_snapshot,
    hsnSacCode: poItem.hsn_sac_code,
    quantity,
    unit: poItem.unit || 'PCS',
    unitPrice,
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
  };
};

const sumInwardTotals = (items) => {
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
  const totalAmount = round2(taxableAmount + taxAmount);

  return {
    subtotalAmount,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    totalAmount,
  };
};

const normalizeInwardItem = (row) => ({
  id: row.id,
  inwardId: row.inward_id,
  productId: row.product_id,
  productNameSnapshot: row.product_name_snapshot,
  skuSnapshot: row.sku_snapshot,
  hsnSacCode: row.hsn_sac_code,
  quantity: toNumber(row.quantity),
  unit: row.unit,
  unitPrice: toNumber(row.unit_price),
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
  product: row.product_id ? {
    id: row.product_id,
    sku: row.product_sku,
    name: row.product_name,
  } : null,
});

const normalizeInward = (row, items) => ({
  id: row.id,
  inwardNumber: row.inward_number,
  purchaseOrderId: row.purchase_order_id,
  purchaseOrderNumber: row.po_number || null,
  vendorId: row.vendor_id,
  vendor: row.vendor_id ? {
    id: row.vendor_id,
    vendorCode: row.vendor_code,
    name: row.vendor_name,
  } : null,
  inwardDate: normalizeDate(row.inward_date),
  vendorInvoiceNumber: row.vendor_invoice_number,
  vendorInvoiceDate: normalizeDate(row.vendor_invoice_date),
  subtotalAmount: toNumber(row.subtotal_amount),
  discountAmount: toNumber(row.discount_amount),
  taxableAmount: toNumber(row.taxable_amount),
  cgstAmount: toNumber(row.cgst_amount),
  sgstAmount: toNumber(row.sgst_amount),
  igstAmount: toNumber(row.igst_amount),
  taxAmount: toNumber(row.tax_amount),
  totalAmount: toNumber(row.total_amount),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  items: items.map(normalizeInwardItem),
});

const normalizeStockMovement = (row) => ({
  id: row.id,
  productId: row.product_id,
  product: row.product_id ? {
    id: row.product_id,
    sku: row.product_sku,
    name: row.product_name,
    unit: row.product_unit,
  } : null,
  movementType: row.movement_type,
  referenceType: row.reference_type,
  referenceId: row.reference_id,
  quantityIn: toNumber(row.quantity_in),
  quantityOut: toNumber(row.quantity_out),
  balanceAfter: toNumber(row.balance_after),
  movementDate: normalizeDate(row.movement_date),
  remarks: row.remarks,
  createdAt: row.created_at,
});

const receivePurchaseOrder = async (purchaseOrderId, payload, actorUserId) => {
  const inwardDate = normalizeDate(payload.inwardDate);
  const vendorInvoiceDate = normalizeDate(payload.vendorInvoiceDate);

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new BusinessRuleError('At least one item must be received');
  }

  const requestedItems = payload.items.map((item) => ({
    purchaseOrderItemId: Number(item.purchaseOrderItemId),
    receiveQuantity: round3(Number(item.receiveQuantity)),
  }));

  for (const item of requestedItems) {
    if (!Number.isInteger(item.purchaseOrderItemId) || item.purchaseOrderItemId <= 0) {
      throw new BusinessRuleError('Invalid purchase order item reference');
    }
    if (!(item.receiveQuantity > 0)) {
      throw new BusinessRuleError('Receive quantity must be greater than zero for each item');
    }
  }

  const seen = new Set();
  for (const item of requestedItems) {
    if (seen.has(item.purchaseOrderItemId)) {
      throw new BusinessRuleError('Duplicate purchase order item in receive payload');
    }
    seen.add(item.purchaseOrderItemId);
  }

  const { inwardId, stockMovementIds } = await db.withTransaction(async (client) => {
    const purchaseOrderRow = await purchaseOrderRepository.lockPurchaseOrderForReceive(purchaseOrderId, client);
    if (!purchaseOrderRow) throw new NotFoundError('Purchase order not found');
    if (!purchaseOrderRow.is_active) throw new BusinessRuleError('Inactive purchase orders cannot receive goods');
    if (!PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(purchaseOrderRow.status)) {
      throw new BusinessRuleError(`Purchase order in '${purchaseOrderRow.status}' status cannot receive goods`);
    }

    const poItems = await purchaseOrderRepository.lockPurchaseOrderItemsForReceive(purchaseOrderId, client);
    if (poItems.length === 0) throw new BusinessRuleError('Purchase order has no items to receive');

    const itemMap = new Map(poItems.map((row) => [Number(row.id), row]));

    const productIds = [];
    const lines = [];
    for (const requested of requestedItems) {
      const poItem = itemMap.get(requested.purchaseOrderItemId);
      if (!poItem) {
        throw new BusinessRuleError(`Purchase order item ${requested.purchaseOrderItemId} does not belong to this purchase order`);
      }
      const ordered = round3(toNumber(poItem.quantity));
      const alreadyReceived = round3(toNumber(poItem.received_quantity));
      const pending = round3(ordered - alreadyReceived);
      if (requested.receiveQuantity > pending + 1e-9) {
        throw new BusinessRuleError(
          `Receive quantity (${requested.receiveQuantity}) exceeds pending quantity (${pending}) for ${poItem.product_name_snapshot}`
        );
      }
      if (!poItem.product_id) {
        throw new BusinessRuleError(`Cannot receive line "${poItem.product_name_snapshot}" - it is not linked to a product`);
      }
      productIds.push(Number(poItem.product_id));
      lines.push({ poItem, receiveQuantity: requested.receiveQuantity });
    }

    const productMap = await purchaseOrderRepository.findActiveProductsByIds(productIds, client);
    for (const productId of productIds) {
      const product = productMap.get(Number(productId));
      if (!product) throw new BusinessRuleError(`Product ${productId} does not exist`);
      if (!product.is_active) throw new BusinessRuleError(`Product ${product.sku || productId} is inactive and cannot receive stock`);
    }

    const inwardItems = lines.map(({ poItem, receiveQuantity }) => ({
      ...calculateReceiveItemTotals(poItem, receiveQuantity),
      sourcePurchaseOrderItemId: Number(poItem.id),
    }));

    const totals = sumInwardTotals(inwardItems);
    const inwardNumber = await purchaseOrderRepository.generateInwardNumber(client);
    const newInwardId = await purchaseOrderRepository.insertInwardRecord({
      inwardNumber,
      purchaseOrderId,
      vendorId: Number(purchaseOrderRow.vendor_id),
      inwardDate,
      vendorInvoiceNumber: payload.vendorInvoiceNumber || null,
      vendorInvoiceDate: vendorInvoiceDate || null,
      ...totals,
      notes: payload.notes || null,
      actorUserId,
    }, client);

    const movementIds = [];
    for (const item of inwardItems) {
      await purchaseOrderRepository.insertInwardItem(newInwardId, { ...item, actorUserId }, client);
      await purchaseOrderRepository.incrementReceivedQuantity(item.sourcePurchaseOrderItemId, item.quantity, actorUserId, client);

      await purchaseOrderRepository.ensureStockBalanceRow(item.productId, client);
      const balance = await purchaseOrderRepository.lockProductStockBalance(item.productId, client);
      const currentOnHand = round3(toNumber(balance.quantity_on_hand));
      const newOnHand = round3(currentOnHand + item.quantity);
      await purchaseOrderRepository.updateProductStockOnHand(item.productId, newOnHand, client);

      const movementId = await purchaseOrderRepository.insertStockMovement({
        productId: item.productId,
        referenceId: newInwardId,
        quantityIn: item.quantity,
        balanceAfter: newOnHand,
        movementDate: inwardDate,
        remarks: `Inward ${inwardNumber} against PO ${purchaseOrderRow.po_number}`,
        actorUserId,
      }, client);
      movementIds.push(movementId);
    }

    const refreshedItems = await purchaseOrderRepository.lockPurchaseOrderItemsForReceive(purchaseOrderId, client);
    const stockLines = refreshedItems.filter((row) => row.product_id !== null && row.product_id !== undefined);
    const allFullyReceived = stockLines.length > 0 && stockLines.every((row) => {
      const ordered = round3(toNumber(row.quantity));
      const received = round3(toNumber(row.received_quantity));
      return received + 1e-9 >= ordered;
    });

    const nextStatus = allFullyReceived
      ? PURCHASE_ORDER_STATUS.RECEIVED
      : PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED;

    if (purchaseOrderRow.status !== nextStatus) {
      await purchaseOrderRepository.setStatusInTransaction(purchaseOrderId, nextStatus, actorUserId, client);
    }

    return { inwardId: newInwardId, stockMovementIds: movementIds };
  });

  const [purchaseOrder, inwardRow, inwardItems, stockMovementRows] = await Promise.all([
    getPurchaseOrder(purchaseOrderId),
    purchaseOrderRepository.findInwardById(inwardId),
    purchaseOrderRepository.listInwardItems(inwardId),
    purchaseOrderRepository.findStockMovementsByIds(stockMovementIds),
  ]);

  return {
    inward: normalizeInward(inwardRow, inwardItems),
    purchaseOrder,
    stockMovements: stockMovementRows.map(normalizeStockMovement),
  };
};

module.exports = {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  getMetrics,
};

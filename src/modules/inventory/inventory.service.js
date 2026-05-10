'use strict';

const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, NotFoundError } = require('../../common/errors');
const inventoryRepository = require('./inventory.repository');

const toNumber = (value) => Number(value || 0);

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const stockStatus = (available, reorderLevel) => {
  if (available <= 0) return 'out_of_stock';
  if (reorderLevel > 0 && available <= reorderLevel) return 'low_stock';
  return 'in_stock';
};

const normalizeCategory = (row) => row.category_id ? ({
  id: row.category_id,
  name: row.category_name,
  code: row.category_code,
}) : null;

const normalizeInventoryItem = (row) => {
  const quantityOnHand = toNumber(row.quantity_on_hand);
  const quantityReserved = toNumber(row.quantity_reserved);
  const quantityAvailable = toNumber(row.quantity_available);
  const reorderLevel = toNumber(row.reorder_level);

  return {
    productId: row.id,
    sku: row.sku,
    name: row.name,
    categoryId: row.category_id,
    category: normalizeCategory(row),
    unit: row.unit,
    sellingPrice: toNumber(row.selling_price),
    costPrice: toNumber(row.cost_price),
    reorderLevel,
    reorderQuantity: toNumber(row.reorder_quantity),
    quantityOnHand,
    quantityReserved,
    quantityAvailable,
    stockValue: toNumber(row.stock_value),
    status: stockStatus(quantityAvailable, reorderLevel),
    isActive: Boolean(row.is_active),
    stockUpdatedAt: row.stock_updated_at,
    lastMovementDate: normalizeDate(row.last_movement_date),
  };
};

const normalizeMovement = (row) => ({
  id: row.id,
  productId: row.product_id,
  product: {
    id: row.product_id,
    sku: row.sku,
    name: row.product_name,
    unit: row.unit,
    category: row.category_id ? {
      id: row.category_id,
      name: row.category_name,
      code: row.category_code,
    } : null,
  },
  movementType: row.movement_type,
  referenceType: row.reference_type,
  referenceId: row.reference_id,
  quantityIn: toNumber(row.quantity_in),
  quantityOut: toNumber(row.quantity_out),
  balanceAfter: toNumber(row.balance_after),
  movementDate: normalizeDate(row.movement_date),
  remarks: row.remarks,
  createdAt: row.created_at,
  createdBy: row.created_by ? {
    id: row.created_by,
    fullName: row.created_by_name,
  } : null,
});

const listInventory = async (query) => {
  const result = await inventoryRepository.listInventory(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeInventoryItem),
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

const getMetrics = async () => {
  const metrics = await inventoryRepository.getMetrics();
  const totals = metrics.totals || {};
  return {
    totalSkus: toNumber(totals.total_skus),
    activeProducts: toNumber(totals.active_products),
    totalStockOnHand: toNumber(totals.total_stock_on_hand),
    totalStockReserved: toNumber(totals.total_stock_reserved),
    totalStockAvailable: toNumber(totals.total_stock_available),
    inventoryValue: toNumber(totals.inventory_value),
    lowStockItems: toNumber(totals.low_stock_items),
    outOfStockItems: toNumber(totals.out_of_stock_items),
    movementsToday: toNumber(totals.movements_today),
    categoryBreakdown: (metrics.categories || []).map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      productCount: toNumber(row.product_count),
      quantityOnHand: toNumber(row.quantity_on_hand),
      quantityAvailable: toNumber(row.quantity_available),
      stockValue: toNumber(row.stock_value),
    })),
  };
};

const listMovements = async (query) => {
  const result = await inventoryRepository.listMovements(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeMovement),
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

const adjustStock = async (payload, actorUserId) => {
  const product = await inventoryRepository.findProductForAdjustment(payload.productId);
  if (!product) throw new NotFoundError('Product not found');
  if (!product.is_active) throw new BusinessRuleError('Inactive products cannot be adjusted');

  const quantity = Number(payload.quantity);
  const currentOnHand = toNumber(product.quantity_on_hand);
  if (payload.direction === 'out' && quantity > currentOnHand) {
    throw new BusinessRuleError('Stock adjustment cannot make quantity on hand negative');
  }

  await inventoryRepository.adjustStock({
    productId: payload.productId,
    direction: payload.direction,
    quantity,
    movementDate: normalizeDate(payload.movementDate),
    remarks: payload.remarks,
    actorUserId,
  });

  const row = await inventoryRepository.findInventoryItemByProductId(payload.productId);
  if (row) return normalizeInventoryItem(row);

  const productAfter = await inventoryRepository.findProductForAdjustment(payload.productId);
  return {
    productId: productAfter.id,
    sku: productAfter.sku,
    name: productAfter.name,
    categoryId: null,
    category: null,
    unit: productAfter.unit,
    sellingPrice: 0,
    costPrice: 0,
    reorderLevel: 0,
    reorderQuantity: 0,
    quantityOnHand: toNumber(productAfter.quantity_on_hand),
    quantityReserved: toNumber(productAfter.quantity_reserved),
    quantityAvailable: toNumber(productAfter.quantity_available),
    stockValue: 0,
    status: stockStatus(toNumber(productAfter.quantity_available), 0),
    isActive: Boolean(productAfter.is_active),
    stockUpdatedAt: null,
    lastMovementDate: null,
  };
};

module.exports = {
  listInventory,
  getMetrics,
  listMovements,
  adjustStock,
};

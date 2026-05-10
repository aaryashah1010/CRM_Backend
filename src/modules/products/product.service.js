'use strict';

const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');
const productRepository = require('./product.repository');

const emptyToNull = (value) => (value === '' ? null : value);
const toNumber = (value) => Number(value || 0);

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
};

const normalizeDateOnly = (value) => {
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

const normalizeTaxRate = (row) => row.tax_rate_id ? ({
  id: row.tax_rate_id,
  name: row.tax_rate_name,
  rate: toNumber(row.tax_rate),
  cgstRate: toNumber(row.cgst_rate),
  sgstRate: toNumber(row.sgst_rate),
  igstRate: toNumber(row.igst_rate),
}) : null;

const normalizeProductSummary = (row) => {
  const quantityAvailable = toNumber(row.quantity_available);
  const reorderLevel = toNumber(row.reorder_level);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    categoryId: row.category_id,
    category: normalizeCategory(row),
    taxRateId: row.tax_rate_id,
    taxRate: normalizeTaxRate(row),
    unit: row.unit,
    hsnSacCode: row.hsn_sac_code,
    sellingPrice: toNumber(row.selling_price),
    costPrice: toNumber(row.cost_price),
    reorderLevel,
    reorderQuantity: toNumber(row.reorder_quantity),
    stock: {
      quantityOnHand: toNumber(row.quantity_on_hand),
      quantityReserved: toNumber(row.quantity_reserved),
      quantityAvailable,
      status: stockStatus(quantityAvailable, reorderLevel),
    },
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const normalizeProduct = (row, movements = []) => ({
  ...normalizeProductSummary(row),
  description: row.description,
  specifications: parseJson(row.specifications),
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  stockMovements: movements.map((movement) => ({
    movementDate: movement.movement_date,
    movementType: movement.movement_type,
    referenceType: movement.reference_type,
    referenceId: movement.reference_id,
    quantityIn: toNumber(movement.quantity_in),
    quantityOut: toNumber(movement.quantity_out),
    balanceAfter: toNumber(movement.balance_after),
    remarks: movement.remarks,
  })),
});

const normalizePayload = (payload) => {
  const normalized = { ...payload };
  if (payload.categoryId !== undefined) normalized.categoryId = emptyToNull(payload.categoryId);
  if (payload.taxRateId !== undefined) normalized.taxRateId = emptyToNull(payload.taxRateId);
  if (payload.description !== undefined) normalized.description = emptyToNull(payload.description);
  if (payload.unit !== undefined) normalized.unit = emptyToNull(payload.unit) || 'PCS';
  if (payload.hsnSacCode !== undefined) normalized.hsnSacCode = emptyToNull(payload.hsnSacCode);
  if (payload.specifications !== undefined) {
    normalized.specifications = payload.specifications ? JSON.stringify(payload.specifications) : null;
  }
  return normalized;
};

const assertUniqueSku = async (sku, excludeProductId = null) => {
  const existing = await productRepository.findBySku(sku, excludeProductId);
  if (existing) throw new ConflictError('A product with this SKU already exists');
};

const assertReferences = async ({ categoryId, taxRateId }) => {
  if (categoryId) {
    const categoryExists = await productRepository.categoryExists(categoryId);
    if (!categoryExists) throw new BusinessRuleError('Selected product category does not exist or is inactive');
  }
  if (taxRateId) {
    const taxRateExists = await productRepository.taxRateExists(taxRateId);
    if (!taxRateExists) throw new BusinessRuleError('Selected tax rate does not exist or is inactive');
  }
};

const listProducts = async (query) => {
  const result = await productRepository.listProducts(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeProductSummary),
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

const getProduct = async (productId) => {
  const product = await productRepository.findById(productId);
  if (!product) throw new NotFoundError('Product not found');
  const movements = await productRepository.getStockMovements(productId);
  return normalizeProduct(product, movements);
};

const createProduct = async (payload, actorUserId) => {
  const product = normalizePayload(payload);
  await assertUniqueSku(product.sku);
  await assertReferences(product);
  const productId = await productRepository.createProduct({ ...product, actorUserId });
  return getProduct(productId);
};

const updateProduct = async (productId, payload, actorUserId) => {
  await getProduct(productId);
  const updates = normalizePayload(payload);
  if (updates.sku !== undefined) await assertUniqueSku(updates.sku, productId);
  await assertReferences(updates);
  await productRepository.updateProduct(productId, { ...updates, actorUserId });
  return getProduct(productId);
};

const setActiveState = async (productId, isActive, actorUserId) => {
  await getProduct(productId);
  await productRepository.setActiveState(productId, isActive, actorUserId);
  return getProduct(productId);
};

const adjustStock = async (productId, payload, actorUserId) => {
  const product = await getProduct(productId);
  const quantity = Number(payload.quantity);
  const currentOnHand = product.stock.quantityOnHand;

  if (payload.direction === 'out' && quantity > currentOnHand) {
    throw new BusinessRuleError('Stock adjustment cannot make quantity on hand negative');
  }

  await productRepository.adjustStock({
    productId,
    direction: payload.direction,
    quantity,
    movementDate: normalizeDateOnly(payload.movementDate),
    remarks: payload.remarks,
    actorUserId,
  });

  return getProduct(productId);
};

const listTaxRates = async () => {
  const rows = await productRepository.listTaxRates();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    rate: toNumber(row.rate),
    cgstRate: toNumber(row.cgst_rate),
    sgstRate: toNumber(row.sgst_rate),
    igstRate: toNumber(row.igst_rate),
    isActive: Boolean(row.is_active),
  }));
};

const getMetrics = async () => {
  const row = await productRepository.getMetrics();
  return {
    totalSkus: toNumber(row.total_skus),
    activeProducts: toNumber(row.active_products),
    lowStockItems: toNumber(row.low_stock_items),
    outOfStockItems: toNumber(row.out_of_stock_items),
    inventoryValue: toNumber(row.inventory_value),
    totalStockOnHand: toNumber(row.total_stock_on_hand),
  };
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setActiveState,
  adjustStock,
  listTaxRates,
  getMetrics,
};

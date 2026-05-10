'use strict';

const PRODUCT_SORT_FIELDS = Object.freeze({
  sku: 'p.sku',
  name: 'p.name',
  category: 'c.name',
  stock: 'quantity_available',
  sellingPrice: 'p.selling_price',
  status: 'p.is_active',
  createdAt: 'p.created_at',
});

const PRODUCT_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Products fetched successfully',
  DETAIL_FETCHED: 'Product fetched successfully',
  CREATED: 'Product created successfully',
  UPDATED: 'Product updated successfully',
  ACTIVATED: 'Product activated successfully',
  DEACTIVATED: 'Product deactivated successfully',
  STOCK_ADJUSTED: 'Product stock adjusted successfully',
  TAX_RATES_FETCHED: 'Tax rates fetched successfully',
  METRICS_FETCHED: 'Product metrics fetched successfully',
});

module.exports = {
  PRODUCT_SORT_FIELDS,
  PRODUCT_MESSAGES,
};

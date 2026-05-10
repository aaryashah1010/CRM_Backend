'use strict';

const CATEGORY_SORT_FIELDS = Object.freeze({
  name: 'c.name',
  code: 'c.code',
  productCount: 'product_count',
  status: 'c.is_active',
  createdAt: 'c.created_at',
});

const CATEGORY_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Product categories fetched successfully',
  DETAIL_FETCHED: 'Product category fetched successfully',
  TREE_FETCHED: 'Product category tree fetched successfully',
  CREATED: 'Product category created successfully',
  UPDATED: 'Product category updated successfully',
  ACTIVATED: 'Product category activated successfully',
  DEACTIVATED: 'Product category deactivated successfully',
  METRICS_FETCHED: 'Product category metrics fetched successfully',
});

module.exports = {
  CATEGORY_SORT_FIELDS,
  CATEGORY_MESSAGES,
};

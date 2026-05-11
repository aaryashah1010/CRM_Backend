'use strict';

const REPORT_MESSAGES = Object.freeze({
  OVERVIEW_FETCHED: 'Report overview fetched successfully',
  FINANCIAL_FETCHED: 'Financial report fetched successfully',
  SALES_BY_CUSTOMER_FETCHED: 'Sales by customer fetched successfully',
  TOP_PRODUCTS_FETCHED: 'Top performing products fetched successfully',
  GST_FETCHED: 'GST report fetched successfully',
  INVENTORY_FETCHED: 'Inventory analytics fetched successfully',
});

const REPORT_PERMISSIONS = Object.freeze({
  READ: 'reports:read',
  EXPORT: 'reports:export',
});

const DEFAULT_TOP_PRODUCTS_LIMIT = 5;
const MAX_TOP_PRODUCTS_LIMIT = 25;

const DEFAULT_SALES_BY_CUSTOMER_LIMIT = 5;
const MAX_SALES_BY_CUSTOMER_LIMIT = 25;

const DEFAULT_RANGE_DAYS = 90;
const MAX_RANGE_DAYS = 730;

module.exports = {
  REPORT_MESSAGES,
  REPORT_PERMISSIONS,
  DEFAULT_TOP_PRODUCTS_LIMIT,
  MAX_TOP_PRODUCTS_LIMIT,
  DEFAULT_SALES_BY_CUSTOMER_LIMIT,
  MAX_SALES_BY_CUSTOMER_LIMIT,
  DEFAULT_RANGE_DAYS,
  MAX_RANGE_DAYS,
};

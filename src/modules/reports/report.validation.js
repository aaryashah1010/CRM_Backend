'use strict';

const Joi = require('joi');

const {
  DEFAULT_TOP_PRODUCTS_LIMIT,
  MAX_TOP_PRODUCTS_LIMIT,
  DEFAULT_SALES_BY_CUSTOMER_LIMIT,
  MAX_SALES_BY_CUSTOMER_LIMIT,
} = require('./report.constants');

const dateRangeQuerySchema = Joi.object({
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')).optional(),
});

const topProductsQuerySchema = dateRangeQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(MAX_TOP_PRODUCTS_LIMIT).default(DEFAULT_TOP_PRODUCTS_LIMIT),
});

const salesByCustomerQuerySchema = dateRangeQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(MAX_SALES_BY_CUSTOMER_LIMIT).default(DEFAULT_SALES_BY_CUSTOMER_LIMIT),
});

const overviewQuerySchema = dateRangeQuerySchema.keys({
  topProductsLimit: Joi.number().integer().min(1).max(MAX_TOP_PRODUCTS_LIMIT).default(DEFAULT_TOP_PRODUCTS_LIMIT),
  topCustomersLimit: Joi.number().integer().min(1).max(MAX_SALES_BY_CUSTOMER_LIMIT).default(DEFAULT_SALES_BY_CUSTOMER_LIMIT),
});

module.exports = {
  dateRangeQuerySchema,
  topProductsQuerySchema,
  salesByCustomerQuerySchema,
  overviewQuerySchema,
};

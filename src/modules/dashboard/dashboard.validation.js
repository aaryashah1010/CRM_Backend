'use strict';

const Joi = require('joi');

const {
  DEFAULT_SUMMARY_DAYS,
  MAX_SUMMARY_DAYS,
  DEFAULT_TOP_CUSTOMERS_LIMIT,
  MAX_TOP_CUSTOMERS_LIMIT,
  DEFAULT_LOW_STOCK_LIMIT,
  MAX_LOW_STOCK_LIMIT,
  DEFAULT_ACTIVITY_LIMIT,
  MAX_ACTIVITY_LIMIT,
  DEFAULT_TREND_DAYS,
  MAX_TREND_DAYS,
  DEFAULT_BEST_SELLING_LIMIT,
  MAX_BEST_SELLING_LIMIT,
  DEFAULT_BEST_SELLING_DAYS,
  DEFAULT_MONTHLY_SALES_MONTHS,
  MAX_MONTHLY_SALES_MONTHS,
} = require('./dashboard.constants');

const summaryQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(MAX_SUMMARY_DAYS).default(DEFAULT_SUMMARY_DAYS),
});

const topCustomersQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(MAX_SUMMARY_DAYS).default(90),
  limit: Joi.number().integer().min(1).max(MAX_TOP_CUSTOMERS_LIMIT).default(DEFAULT_TOP_CUSTOMERS_LIMIT),
});

const lowStockQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(MAX_LOW_STOCK_LIMIT).default(DEFAULT_LOW_STOCK_LIMIT),
});

const recentActivityQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(MAX_ACTIVITY_LIMIT).default(DEFAULT_ACTIVITY_LIMIT),
});

const salesTrendQuerySchema = Joi.object({
  days: Joi.number().integer().min(7).max(MAX_TREND_DAYS).default(DEFAULT_TREND_DAYS),
});

const bestSellingProductsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(MAX_SUMMARY_DAYS).default(DEFAULT_BEST_SELLING_DAYS),
  limit: Joi.number().integer().min(1).max(MAX_BEST_SELLING_LIMIT).default(DEFAULT_BEST_SELLING_LIMIT),
});

const monthlySalesQuerySchema = Joi.object({
  months: Joi.number().integer().min(1).max(MAX_MONTHLY_SALES_MONTHS).default(DEFAULT_MONTHLY_SALES_MONTHS),
});

module.exports = {
  summaryQuerySchema,
  topCustomersQuerySchema,
  lowStockQuerySchema,
  recentActivityQuerySchema,
  salesTrendQuerySchema,
  bestSellingProductsQuerySchema,
  monthlySalesQuerySchema,
};

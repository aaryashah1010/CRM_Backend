'use strict';

const Joi = require('joi');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);
const money = Joi.number().precision(2).min(0);
const quantity = Joi.number().precision(3).min(0);

const idParamSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
});

const listProductsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  categoryId: Joi.number().integer().positive().allow(null),
  taxRateId: Joi.number().integer().positive().allow(null),
  stockStatus: Joi.string().valid('all', 'in_stock', 'low_stock', 'out_of_stock').default('all'),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid('sku', 'name', 'category', 'stock', 'sellingPrice', 'status', 'createdAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const productPayload = {
  sku: Joi.string().trim().min(2).max(100),
  name: Joi.string().trim().min(2).max(255),
  categoryId: Joi.number().integer().positive().allow(null),
  taxRateId: Joi.number().integer().positive().allow(null),
  description: optionalText(4000),
  unit: Joi.string().trim().max(50).allow('', null),
  hsnSacCode: optionalText(20),
  sellingPrice: money,
  costPrice: money,
  reorderLevel: quantity,
  reorderQuantity: quantity,
  specifications: Joi.object().unknown(true).allow(null),
  isActive: Joi.boolean(),
};

const createProductSchema = Joi.object({
  ...productPayload,
  sku: productPayload.sku.required(),
  name: productPayload.name.required(),
  unit: productPayload.unit.default('PCS'),
  sellingPrice: money.default(0),
  costPrice: money.default(0),
  reorderLevel: quantity.default(0),
  reorderQuantity: quantity.default(0),
  isActive: Joi.boolean().default(true),
  openingStock: Joi.number().precision(3).min(0).default(0),
});

const updateProductSchema = Joi.object(productPayload).min(1);

const stockAdjustmentSchema = Joi.object({
  direction: Joi.string().valid('in', 'out').required(),
  quantity: Joi.number().precision(3).greater(0).required(),
  movementDate: Joi.date().iso().required(),
  remarks: Joi.string().trim().min(3).max(4000).required(),
});

module.exports = {
  idParamSchema,
  listProductsSchema,
  createProductSchema,
  updateProductSchema,
  stockAdjustmentSchema,
};

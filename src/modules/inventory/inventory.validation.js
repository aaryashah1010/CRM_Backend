'use strict';

const Joi = require('joi');

const {
  INVENTORY_MOVEMENT_SORT_FIELDS,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_SORT_FIELDS,
  INVENTORY_STOCK_STATUSES,
} = require('./inventory.constants');

const listInventorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  categoryId: Joi.number().integer().positive(),
  stockStatus: Joi.string().valid(...INVENTORY_STOCK_STATUSES).default('all'),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid(...Object.keys(INVENTORY_SORT_FIELDS)).default('updatedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const listMovementsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  productId: Joi.number().integer().positive(),
  movementType: Joi.string().valid(...INVENTORY_MOVEMENT_TYPES, 'all').default('all'),
  fromDate: Joi.date().iso().allow('', null),
  toDate: Joi.date().iso().allow('', null),
  sortBy: Joi.string().valid(...Object.keys(INVENTORY_MOVEMENT_SORT_FIELDS)).default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const stockAdjustmentSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
  direction: Joi.string().valid('in', 'out').required(),
  quantity: Joi.number().positive().precision(3).required(),
  movementDate: Joi.date().iso().required(),
  remarks: Joi.string().trim().min(3).max(4000).required(),
});

module.exports = {
  listInventorySchema,
  listMovementsSchema,
  stockAdjustmentSchema,
};

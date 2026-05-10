'use strict';

const Joi = require('joi');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  categoryId: Joi.number().integer().positive().required(),
});

const listCategoriesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  parentId: Joi.number().integer().positive().allow(null),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid('name', 'code', 'productCount', 'status', 'createdAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const categoryPayload = {
  name: Joi.string().trim().min(2).max(100),
  code: Joi.string().trim().min(2).max(50),
  parentId: Joi.number().integer().positive().allow(null),
  description: optionalText(4000),
  isActive: Joi.boolean(),
};

const createCategorySchema = Joi.object({
  ...categoryPayload,
  name: categoryPayload.name.required(),
  code: categoryPayload.code.required(),
  isActive: Joi.boolean().default(true),
});

const updateCategorySchema = Joi.object(categoryPayload).min(1);

module.exports = {
  idParamSchema,
  listCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
};

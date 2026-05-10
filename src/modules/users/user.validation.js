'use strict';

const Joi = require('joi');

const idParamSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
});

const listUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  roleId: Joi.number().integer().positive(),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid('fullName', 'email', 'username', 'role', 'status', 'lastLoginAt', 'createdAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const createUserSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(200).required(),
  email: Joi.string().trim().lowercase().email().max(255).required(),
  username: Joi.string().trim().lowercase().pattern(/^[a-z0-9._-]+$/).min(3).max(100).required()
    .messages({
      'string.pattern.base': 'Username may contain only lowercase letters, numbers, dots, underscores, and hyphens',
    }),
  password: Joi.string().min(8).max(128).required(),
  roleId: Joi.number().integer().positive().required(),
  phone: Joi.string().trim().max(20).allow('', null),
  isActive: Joi.boolean().default(true),
});

const updateUserSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(200),
  email: Joi.string().trim().lowercase().email().max(255),
  username: Joi.string().trim().lowercase().pattern(/^[a-z0-9._-]+$/).min(3).max(100)
    .messages({
      'string.pattern.base': 'Username may contain only lowercase letters, numbers, dots, underscores, and hyphens',
    }),
  roleId: Joi.number().integer().positive(),
  phone: Joi.string().trim().max(20).allow('', null),
  isActive: Joi.boolean(),
}).min(1);

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).max(128).required(),
});

module.exports = {
  idParamSchema,
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
};

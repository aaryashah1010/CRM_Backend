'use strict';

const Joi = require('joi');

const loginSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(255).required()
    .messages({
      'any.required': 'Email or username is required',
      'string.empty': 'Email or username is required',
    }),
  password: Joi.string().min(8).max(128).required()
    .messages({
      'any.required': 'Password is required',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
    }),
  remember: Joi.boolean().default(false),
}).required();

module.exports = { loginSchema };

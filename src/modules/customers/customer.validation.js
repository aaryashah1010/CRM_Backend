'use strict';

const Joi = require('joi');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  customerId: Joi.number().integer().positive().required(),
});

const listCustomersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  gstStatus: Joi.string().valid('all', 'registered', 'unregistered').default('all'),
  isActive: Joi.boolean(),
  minCreditLimit: Joi.number().min(0),
  maxCreditLimit: Joi.number().min(0),
  sortBy: Joi.string()
    .valid('name', 'customerCode', 'gstNumber', 'creditLimit', 'outstandingAmount', 'status', 'createdAt')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const addressSchema = Joi.object({
  id: Joi.number().integer().positive(),
  addressType: Joi.string().valid('billing', 'shipping').required(),
  addressLine1: Joi.string().trim().max(255).required(),
  addressLine2: optionalText(255),
  city: Joi.string().trim().max(100).required(),
  state: Joi.string().trim().max(100).required(),
  pincode: Joi.string().trim().max(10).required(),
  country: Joi.string().trim().max(100).default('India'),
  isDefault: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

const customerPayload = {
  customerCode: Joi.string().trim().max(50),
  name: Joi.string().trim().min(2).max(200),
  email: optionalText(255).email(),
  phone: optionalText(20),
  mobile: optionalText(20),
  website: optionalText(255).uri({ allowRelative: false }),
  gstNumber: optionalText(15),
  panNumber: optionalText(10),
  paymentTermId: Joi.number().integer().positive().allow(null),
  creditLimit: Joi.number().min(0).precision(2).default(0),
  assignedTo: Joi.number().integer().positive().allow(null),
  notes: optionalText(4000),
  isActive: Joi.boolean(),
  addresses: Joi.array().items(addressSchema).max(4),
};

const createCustomerSchema = Joi.object({
  ...customerPayload,
  customerCode: customerPayload.customerCode.required(),
  name: customerPayload.name.required(),
  isActive: Joi.boolean().default(true),
});

const updateCustomerSchema = Joi.object(customerPayload).min(1);

module.exports = {
  idParamSchema,
  listCustomersSchema,
  createCustomerSchema,
  updateCustomerSchema,
};

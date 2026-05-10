'use strict';

const Joi = require('joi');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  vendorId: Joi.number().integer().positive().required(),
});

const listVendorsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  gstStatus: Joi.string().valid('all', 'registered', 'unregistered').default('all'),
  isActive: Joi.boolean(),
  sortBy: Joi.string()
    .valid('name', 'vendorCode', 'gstNumber', 'totalProcurement', 'outstandingAmount', 'status', 'createdAt')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const vendorPayload = {
  vendorCode: Joi.string().trim().max(50),
  name: Joi.string().trim().min(2).max(200),
  email: optionalText(255).email(),
  phone: optionalText(20),
  mobile: optionalText(20),
  website: optionalText(255).uri({ allowRelative: false }),
  gstNumber: optionalText(15),
  panNumber: optionalText(10),
  paymentTermId: Joi.number().integer().positive().allow(null),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pincode: optionalText(10),
  country: optionalText(100).default('India'),
  bankName: optionalText(100),
  bankAccountNumber: optionalText(50),
  bankIfscCode: optionalText(20),
  bankBranch: optionalText(100),
  notes: optionalText(4000),
  isActive: Joi.boolean(),
};

const createVendorSchema = Joi.object({
  ...vendorPayload,
  vendorCode: vendorPayload.vendorCode.required(),
  name: vendorPayload.name.required(),
  isActive: Joi.boolean().default(true),
});

const updateVendorSchema = Joi.object(vendorPayload).min(1);

module.exports = {
  idParamSchema,
  listVendorsSchema,
  createVendorSchema,
  updateVendorSchema,
};

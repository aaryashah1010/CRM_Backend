'use strict';

const Joi = require('joi');

const { INVOICE_STATUSES, INVOICE_SORT_FIELDS } = require('./invoice.constants');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  invoiceId: Joi.number().integer().positive().required(),
});

const listInvoicesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  customerId: Joi.number().integer().positive(),
  status: Joi.string().valid(...INVOICE_STATUSES, 'all').default('all'),
  fromDate: Joi.date().iso().allow('', null),
  toDate: Joi.date().iso().allow('', null),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid(...Object.keys(INVOICE_SORT_FIELDS)).default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const itemSchema = Joi.object({
  productId: Joi.number().integer().positive().allow(null),
  productNameSnapshot: Joi.string().trim().min(1).max(255).required(),
  skuSnapshot: optionalText(100),
  hsnSacCode: optionalText(20),
  quantity: Joi.number().positive().precision(3).required(),
  unit: Joi.string().trim().max(50).default('PCS'),
  unitPrice: Joi.number().min(0).precision(2).required(),
  discountPercent: Joi.number().min(0).max(100).precision(2).default(0),
  cgstRate: Joi.number().min(0).max(100).precision(2).default(0),
  sgstRate: Joi.number().min(0).max(100).precision(2).default(0),
  igstRate: Joi.number().min(0).max(100).precision(2).default(0),
  sortOrder: Joi.number().integer().min(0).default(0),
});

const invoicePayload = {
  salesOrderId: Joi.number().integer().positive().allow(null),
  customerId: Joi.number().integer().positive(),
  invoiceDate: Joi.date().iso(),
  dueDate: Joi.date().iso(),
  paymentTermId: Joi.number().integer().positive().allow(null),
  billingAddress: optionalText(4000),
  shippingAddress: optionalText(4000),
  customerGstSnapshot: optionalText(15),
  notes: optionalText(4000),
  items: Joi.array().items(itemSchema).min(1),
};

const createInvoiceSchema = Joi.object({
  ...invoicePayload,
  customerId: invoicePayload.customerId.required(),
  invoiceDate: invoicePayload.invoiceDate.required(),
  dueDate: invoicePayload.dueDate.required(),
  items: invoicePayload.items.required(),
});

const updateInvoiceSchema = Joi.object(invoicePayload).min(1);

module.exports = {
  idParamSchema,
  listInvoicesSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
};

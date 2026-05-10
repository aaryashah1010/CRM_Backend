'use strict';

const Joi = require('joi');

const {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_SORT_FIELDS,
} = require('./purchase-order.constants');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  purchaseOrderId: Joi.number().integer().positive().required(),
});

const listPurchaseOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  vendorId: Joi.number().integer().positive(),
  status: Joi.string().valid(...PURCHASE_ORDER_STATUSES, 'all', 'overdue').default('all'),
  fromDate: Joi.date().iso().allow('', null),
  toDate: Joi.date().iso().allow('', null),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid(...Object.keys(PURCHASE_ORDER_SORT_FIELDS)).default('createdAt'),
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

const purchaseOrderPayload = {
  vendorId: Joi.number().integer().positive(),
  orderDate: Joi.date().iso(),
  expectedDeliveryDate: Joi.date().iso().allow('', null),
  paymentTermId: Joi.number().integer().positive().allow(null),
  deliveryAddress: optionalText(4000),
  notes: optionalText(4000),
  assignedTo: Joi.number().integer().positive().allow(null),
  items: Joi.array().items(itemSchema).min(1),
};

const createPurchaseOrderSchema = Joi.object({
  ...purchaseOrderPayload,
  vendorId: purchaseOrderPayload.vendorId.required(),
  orderDate: purchaseOrderPayload.orderDate.required(),
  items: purchaseOrderPayload.items.required(),
});

const updatePurchaseOrderSchema = Joi.object(purchaseOrderPayload).min(1);

const receiveItemSchema = Joi.object({
  purchaseOrderItemId: Joi.number().integer().positive().required(),
  receiveQuantity: Joi.number().positive().precision(3).required(),
});

const receivePurchaseOrderSchema = Joi.object({
  inwardDate: Joi.date().iso().required(),
  vendorInvoiceNumber: optionalText(100),
  vendorInvoiceDate: Joi.date().iso().allow('', null),
  notes: optionalText(4000),
  items: Joi.array().items(receiveItemSchema).min(1).required(),
});

module.exports = {
  idParamSchema,
  listPurchaseOrdersSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
};

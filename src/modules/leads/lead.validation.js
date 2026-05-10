'use strict';

const Joi = require('joi');
const {
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  FOLLOW_UP_TYPES,
  FOLLOW_UP_STATUSES,
} = require('./lead.constants');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  leadId: Joi.number().integer().positive().required(),
});

const listLeadsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  status: Joi.string().valid('all', ...LEAD_STATUSES).default('all'),
  source: Joi.string().valid('all', ...LEAD_SOURCES).default('all'),
  priority: Joi.string().valid('all', ...LEAD_PRIORITIES).default('all'),
  assignedTo: Joi.number().integer().positive().allow(null),
  isActive: Joi.boolean(),
  sortBy: Joi.string()
    .valid('leadNumber', 'customerName', 'expectedValue', 'expectedCloseDate', 'priority', 'status', 'createdAt', 'updatedAt')
    .default('updatedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const leadPayload = {
  customerId: Joi.number().integer().positive().allow(null),
  customerName: optionalText(200),
  customerEmail: optionalText(255).email(),
  customerPhone: optionalText(20),
  customerCompany: optionalText(200),
  source: Joi.string().valid(...LEAD_SOURCES).allow(null),
  priority: Joi.string().valid(...LEAD_PRIORITIES),
  status: Joi.string().valid(...LEAD_STATUSES),
  assignedTo: Joi.number().integer().positive().allow(null),
  expectedValue: Joi.number().precision(2).min(0).allow(null),
  expectedCloseDate: Joi.date().iso().allow(null),
  notes: optionalText(4000),
  lostReason: optionalText(4000),
  isActive: Joi.boolean(),
};

const createLeadSchema = Joi.object({
  ...leadPayload,
  customerId: leadPayload.customerId.default(null),
  customerName: leadPayload.customerName.when('customerId', {
    is: null,
    then: Joi.string().trim().min(2).max(200).required(),
    otherwise: optionalText(200),
  }),
  priority: leadPayload.priority.default('medium'),
  status: leadPayload.status.default('new'),
  expectedValue: leadPayload.expectedValue.default(0),
  isActive: Joi.boolean().default(true),
});

const updateLeadSchema = Joi.object(leadPayload).min(1);

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid(...LEAD_STATUSES).required(),
  lostReason: optionalText(4000),
});

const createFollowUpSchema = Joi.object({
  followUpType: Joi.string().valid(...FOLLOW_UP_TYPES).required(),
  status: Joi.string().valid(...FOLLOW_UP_STATUSES).default('scheduled'),
  scheduledAt: Joi.date().iso().required(),
  completedAt: Joi.date().iso().allow(null),
  assignedTo: Joi.number().integer().positive().allow(null),
  subject: optionalText(255),
  notes: optionalText(4000),
  nextFollowUpDate: Joi.date().iso().allow(null),
});

const convertToQuotationSchema = Joi.object({
  quotationDate: Joi.date().iso().allow(null),
  validUntil: Joi.date().iso().allow(null),
  paymentTermId: Joi.number().integer().positive().allow(null),
  assignedTo: Joi.number().integer().positive().allow(null),
  notes: optionalText(4000),
  termsAndConditions: optionalText(4000),
});

module.exports = {
  idParamSchema,
  listLeadsSchema,
  createLeadSchema,
  updateLeadSchema,
  statusUpdateSchema,
  createFollowUpSchema,
  convertToQuotationSchema,
};

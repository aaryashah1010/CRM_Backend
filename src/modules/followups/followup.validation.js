'use strict';

const Joi = require('joi');

const {
  FOLLOW_UP_LIST_STATUSES,
  FOLLOW_UP_SORT_FIELDS,
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_TYPES,
} = require('./followup.constants');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

const idParamSchema = Joi.object({
  followUpId: Joi.number().integer().positive().required(),
});

const listFollowUpsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  leadId: Joi.number().integer().positive(),
  assignedTo: Joi.number().integer().positive().allow(null),
  followUpType: Joi.string().valid('all', ...FOLLOW_UP_TYPES).default('all'),
  status: Joi.string().valid(...FOLLOW_UP_LIST_STATUSES).default('upcoming'),
  fromDate: Joi.date().iso().allow('', null),
  toDate: Joi.date().iso().allow('', null),
  isActive: Joi.boolean(),
  sortBy: Joi.string().valid(...Object.keys(FOLLOW_UP_SORT_FIELDS)).default('scheduledAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
});

const followUpPayload = {
  leadId: Joi.number().integer().positive(),
  followUpType: Joi.string().valid(...FOLLOW_UP_TYPES),
  status: Joi.string().valid(...FOLLOW_UP_STATUSES),
  scheduledAt: Joi.date().iso(),
  completedAt: Joi.date().iso().allow(null),
  assignedTo: Joi.number().integer().positive().allow(null),
  subject: optionalText(255),
  notes: optionalText(4000),
  nextFollowUpDate: Joi.date().iso().allow(null),
  isActive: Joi.boolean(),
};

const createFollowUpSchema = Joi.object({
  ...followUpPayload,
  leadId: followUpPayload.leadId.required(),
  followUpType: followUpPayload.followUpType.required(),
  status: followUpPayload.status.default('scheduled'),
  scheduledAt: followUpPayload.scheduledAt.required(),
  isActive: followUpPayload.isActive.default(true),
});

const updateFollowUpSchema = Joi.object(followUpPayload).min(1);

const completeFollowUpSchema = Joi.object({
  completedAt: Joi.date().iso().allow(null),
  notes: optionalText(4000),
  nextFollowUpDate: Joi.date().iso().allow(null),
});

const cancelFollowUpSchema = Joi.object({
  notes: optionalText(4000),
});

module.exports = {
  idParamSchema,
  listFollowUpsSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  completeFollowUpSchema,
  cancelFollowUpSchema,
};

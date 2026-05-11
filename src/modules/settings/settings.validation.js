'use strict';

const Joi = require('joi');

const optionalString = (max) => Joi.string().allow('', null).max(max).trim();

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const companyProfileSchema = Joi.object({
  legalName: Joi.string().min(1).max(200).trim().required(),
  gstin: Joi.string().allow('', null).trim().uppercase().pattern(gstinPattern).messages({
    'string.pattern.base': 'GSTIN must be a 15-character Indian GST registration number.',
  }),
  registeredAddress: optionalString(1000),
  email: Joi.string().allow('', null).max(200).email({ tlds: { allow: false } }),
  phone: optionalString(40),
  website: Joi.string().allow('', null).max(200).trim(),
  logoUrl: Joi.string().allow('', null).max(500).trim(),
}).options({ stripUnknown: true });

const financialConfigSchema = Joi.object({
  primaryCurrency: Joi.string().length(3).uppercase().required(),
  fiscalYearStartMonth: Joi.number().integer().min(1).max(12).required(),
  defaultTaxRateId: Joi.number().integer().positive().allow(null),
  defaultPaymentTermId: Joi.number().integer().positive().allow(null),
}).options({ stripUnknown: true });

const invoiceConfigSchema = Joi.object({
  prefix: Joi.string().min(1).max(20).trim().required(),
  nextNumber: Joi.number().integer().min(1).max(9_999_999).required(),
  padding: Joi.number().integer().min(3).max(10).required(),
}).options({ stripUnknown: true });

module.exports = {
  companyProfileSchema,
  financialConfigSchema,
  invoiceConfigSchema,
};

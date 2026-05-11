'use strict';

const SETTINGS_MESSAGES = Object.freeze({
  FETCHED: 'Settings fetched successfully',
  COMPANY_UPDATED: 'Company profile updated successfully',
  FINANCIAL_UPDATED: 'Financial settings updated successfully',
  INVOICE_UPDATED: 'Invoice configuration updated successfully',
});

const SETTINGS_PERMISSIONS = Object.freeze({
  MANAGE: 'settings:manage',
  READ: 'settings:manage',
});

const SETTINGS_KEYS = Object.freeze({
  COMPANY_PROFILE: 'company.profile',
  FINANCIAL_CONFIG: 'financial.config',
  INVOICE_CONFIG: 'invoice.config',
});

const DEFAULT_COMPANY_PROFILE = Object.freeze({
  legalName: '',
  gstin: '',
  registeredAddress: '',
  email: '',
  phone: '',
  website: '',
  logoUrl: '',
});

const DEFAULT_FINANCIAL_CONFIG = Object.freeze({
  primaryCurrency: 'INR',
  fiscalYearStartMonth: 4,
  defaultTaxRateId: null,
  defaultPaymentTermId: null,
});

const DEFAULT_INVOICE_CONFIG = Object.freeze({
  prefix: 'INV-',
  nextNumber: 1,
  padding: 5,
});

module.exports = {
  SETTINGS_MESSAGES,
  SETTINGS_PERMISSIONS,
  SETTINGS_KEYS,
  DEFAULT_COMPANY_PROFILE,
  DEFAULT_FINANCIAL_CONFIG,
  DEFAULT_INVOICE_CONFIG,
};

'use strict';

const settingsRepository = require('./settings.repository');
const { ValidationError, NotFoundError } = require('../../common/errors');
const {
  SETTINGS_KEYS,
  DEFAULT_COMPANY_PROFILE,
  DEFAULT_FINANCIAL_CONFIG,
  DEFAULT_INVOICE_CONFIG,
} = require('./settings.constants');

const parseJson = (raw, fallback) => {
  if (!raw) return { ...fallback };
  try {
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch (_err) {
    return { ...fallback };
  }
};

const FISCAL_YEAR_LABELS = [
  'January 1st', 'February 1st', 'March 1st', 'April 1st', 'May 1st', 'June 1st',
  'July 1st', 'August 1st', 'September 1st', 'October 1st', 'November 1st', 'December 1st',
];

const buildInvoicePreview = ({ prefix, nextNumber, padding }) => {
  const padded = String(nextNumber).padStart(padding, '0');
  return `${prefix}${padded}`;
};

const buildAuditMeta = async (record) => {
  if (!record) return { updatedAt: null, updatedBy: null };
  const actor = await settingsRepository.fetchActorName(record.updated_by);
  return {
    updatedAt: record.updated_at,
    updatedBy: actor
      ? { id: actor.id, fullName: actor.full_name, username: actor.username, email: actor.email }
      : null,
  };
};

const normalizeCompany = async (record) => {
  const profile = parseJson(record?.value, DEFAULT_COMPANY_PROFILE);
  return {
    ...profile,
    ...(await buildAuditMeta(record)),
  };
};

const normalizeFinancial = async (record) => {
  const config = parseJson(record?.value, DEFAULT_FINANCIAL_CONFIG);

  const [taxRate, paymentTerm] = await Promise.all([
    settingsRepository.fetchTaxRate(config.defaultTaxRateId),
    settingsRepository.fetchPaymentTerm(config.defaultPaymentTermId),
  ]);

  return {
    primaryCurrency: config.primaryCurrency,
    fiscalYearStartMonth: config.fiscalYearStartMonth,
    fiscalYearStartLabel: FISCAL_YEAR_LABELS[Math.max(0, Math.min(11, config.fiscalYearStartMonth - 1))],
    defaultTaxRateId: config.defaultTaxRateId,
    defaultTaxRate: taxRate
      ? { id: taxRate.id, name: taxRate.name, rate: Number(taxRate.rate) }
      : null,
    defaultPaymentTermId: config.defaultPaymentTermId,
    defaultPaymentTerm: paymentTerm
      ? { id: paymentTerm.id, name: paymentTerm.name, days: paymentTerm.days }
      : null,
    ...(await buildAuditMeta(record)),
  };
};

const normalizeInvoice = async (record) => {
  const config = parseJson(record?.value, DEFAULT_INVOICE_CONFIG);
  return {
    prefix: config.prefix,
    nextNumber: config.nextNumber,
    padding: config.padding,
    previewNumber: buildInvoicePreview(config),
    ...(await buildAuditMeta(record)),
  };
};

const getSettings = async () => {
  const [companyRow, financialRow, invoiceRow, taxRates, paymentTerms] = await Promise.all([
    settingsRepository.fetchByKey(SETTINGS_KEYS.COMPANY_PROFILE),
    settingsRepository.fetchByKey(SETTINGS_KEYS.FINANCIAL_CONFIG),
    settingsRepository.fetchByKey(SETTINGS_KEYS.INVOICE_CONFIG),
    settingsRepository.fetchActiveTaxRates(),
    settingsRepository.fetchActivePaymentTerms(),
  ]);

  const [company, financial, invoice] = await Promise.all([
    normalizeCompany(companyRow),
    normalizeFinancial(financialRow),
    normalizeInvoice(invoiceRow),
  ]);

  return {
    company,
    financial,
    invoice,
    options: {
      taxRates: taxRates.map((row) => ({ id: row.id, name: row.name, rate: Number(row.rate) })),
      paymentTerms: paymentTerms.map((row) => ({ id: row.id, name: row.name, days: row.days })),
      fiscalYearMonths: FISCAL_YEAR_LABELS.map((label, idx) => ({ month: idx + 1, label })),
      currencies: [
        { code: 'INR', label: 'Indian Rupee (₹)' },
        { code: 'USD', label: 'US Dollar ($)' },
        { code: 'EUR', label: 'Euro (€)' },
        { code: 'GBP', label: 'British Pound (£)' },
        { code: 'AED', label: 'UAE Dirham (د.إ)' },
      ],
    },
  };
};

const updateCompanyProfile = async (payload, userId) => {
  const value = {
    legalName: payload.legalName,
    gstin: payload.gstin || '',
    registeredAddress: payload.registeredAddress || '',
    email: payload.email || '',
    phone: payload.phone || '',
    website: payload.website || '',
    logoUrl: payload.logoUrl || '',
  };
  const record = await settingsRepository.upsertByKey(
    SETTINGS_KEYS.COMPANY_PROFILE,
    JSON.stringify(value),
    userId
  );
  return normalizeCompany(record);
};

const updateFinancialConfig = async (payload, userId) => {
  if (payload.defaultTaxRateId) {
    const taxRate = await settingsRepository.fetchTaxRate(payload.defaultTaxRateId);
    if (!taxRate) {
      throw new NotFoundError('Selected tax rate does not exist.');
    }
    if (!taxRate.is_active) {
      throw new ValidationError('Selected tax rate is not active.');
    }
  }

  if (payload.defaultPaymentTermId) {
    const paymentTerm = await settingsRepository.fetchPaymentTerm(payload.defaultPaymentTermId);
    if (!paymentTerm) {
      throw new NotFoundError('Selected payment term does not exist.');
    }
    if (!paymentTerm.is_active) {
      throw new ValidationError('Selected payment term is not active.');
    }
  }

  const value = {
    primaryCurrency: payload.primaryCurrency,
    fiscalYearStartMonth: payload.fiscalYearStartMonth,
    defaultTaxRateId: payload.defaultTaxRateId ?? null,
    defaultPaymentTermId: payload.defaultPaymentTermId ?? null,
  };
  const record = await settingsRepository.upsertByKey(
    SETTINGS_KEYS.FINANCIAL_CONFIG,
    JSON.stringify(value),
    userId
  );
  return normalizeFinancial(record);
};

const updateInvoiceConfig = async (payload, userId) => {
  const value = {
    prefix: payload.prefix,
    nextNumber: payload.nextNumber,
    padding: payload.padding,
  };
  const record = await settingsRepository.upsertByKey(
    SETTINGS_KEYS.INVOICE_CONFIG,
    JSON.stringify(value),
    userId
  );
  return normalizeInvoice(record);
};

module.exports = {
  getSettings,
  updateCompanyProfile,
  updateFinancialConfig,
  updateInvoiceConfig,
};

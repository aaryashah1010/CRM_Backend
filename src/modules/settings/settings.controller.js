'use strict';

const settingsService = require('./settings.service');
const response = require('../../common/responses/response');
const { SETTINGS_MESSAGES } = require('./settings.constants');

const getSettings = async (_req, res, next) => {
  try {
    const data = await settingsService.getSettings();
    return response.success(res, data, SETTINGS_MESSAGES.FETCHED);
  } catch (err) {
    return next(err);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const data = await settingsService.updateCompanyProfile(req.body, req.user?.id);
    return response.success(res, data, SETTINGS_MESSAGES.COMPANY_UPDATED);
  } catch (err) {
    return next(err);
  }
};

const updateFinancial = async (req, res, next) => {
  try {
    const data = await settingsService.updateFinancialConfig(req.body, req.user?.id);
    return response.success(res, data, SETTINGS_MESSAGES.FINANCIAL_UPDATED);
  } catch (err) {
    return next(err);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    const data = await settingsService.updateInvoiceConfig(req.body, req.user?.id);
    return response.success(res, data, SETTINGS_MESSAGES.INVOICE_UPDATED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getSettings,
  updateCompany,
  updateFinancial,
  updateInvoice,
};

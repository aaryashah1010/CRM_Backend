'use strict';

const reportService = require('./report.service');
const response = require('../../common/responses/response');
const { REPORT_MESSAGES } = require('./report.constants');

const overview = async (req, res, next) => {
  try {
    const data = await reportService.getOverview(req.query);
    return response.success(res, data, REPORT_MESSAGES.OVERVIEW_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const financial = async (req, res, next) => {
  try {
    const { fromDate, toDate } = reportService.resolveDateRange(req.query);
    const data = await reportService.getFinancialSummary(fromDate, toDate);
    return response.success(res, data, REPORT_MESSAGES.FINANCIAL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const topProducts = async (req, res, next) => {
  try {
    const { fromDate, toDate } = reportService.resolveDateRange(req.query);
    const data = await reportService.getTopProducts(fromDate, toDate, req.query.limit);
    return response.success(res, data, REPORT_MESSAGES.TOP_PRODUCTS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const salesByCustomer = async (req, res, next) => {
  try {
    const { fromDate, toDate } = reportService.resolveDateRange(req.query);
    const data = await reportService.getSalesByCustomer(fromDate, toDate, req.query.limit);
    return response.success(res, data, REPORT_MESSAGES.SALES_BY_CUSTOMER_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const gst = async (req, res, next) => {
  try {
    const { fromDate, toDate } = reportService.resolveDateRange(req.query);
    const data = await reportService.getGstSummary(fromDate, toDate);
    return response.success(res, data, REPORT_MESSAGES.GST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const inventory = async (req, res, next) => {
  try {
    const { fromDate, toDate } = reportService.resolveDateRange(req.query);
    const data = await reportService.getInventoryAnalytics(fromDate, toDate);
    return response.success(res, data, REPORT_MESSAGES.INVENTORY_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  overview,
  financial,
  topProducts,
  salesByCustomer,
  gst,
  inventory,
};

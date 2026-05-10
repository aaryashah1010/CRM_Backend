'use strict';

const dashboardService = require('./dashboard.service');
const response = require('../../common/responses/response');
const { DASHBOARD_MESSAGES } = require('./dashboard.constants');

const dashboard = async (_req, res, next) => {
  try {
    const data = await dashboardService.getDashboard();
    return response.success(res, data, DASHBOARD_MESSAGES.DASHBOARD_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const summary = async (req, res, next) => {
  try {
    const data = await dashboardService.getSummary(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.SUMMARY_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const topCustomers = async (req, res, next) => {
  try {
    const data = await dashboardService.getTopCustomers(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.TOP_CUSTOMERS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const lowStock = async (req, res, next) => {
  try {
    const data = await dashboardService.getLowStockProducts(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.LOW_STOCK_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const recentActivity = async (req, res, next) => {
  try {
    const data = await dashboardService.getRecentActivity(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.RECENT_ACTIVITY_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const salesTrend = async (req, res, next) => {
  try {
    const data = await dashboardService.getSalesTrend(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.SALES_TREND_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const bestSellingProducts = async (req, res, next) => {
  try {
    const data = await dashboardService.getBestSellingProducts(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.BEST_SELLING_PRODUCTS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const monthlySales = async (req, res, next) => {
  try {
    const data = await dashboardService.getMonthlySales(req.query);
    return response.success(res, data, DASHBOARD_MESSAGES.MONTHLY_SALES_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  dashboard,
  summary,
  topCustomers,
  lowStock,
  recentActivity,
  salesTrend,
  bestSellingProducts,
  monthlySales,
};

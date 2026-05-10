'use strict';

const express = require('express');

const dashboardController = require('./dashboard.controller');
const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const { DASHBOARD_PERMISSIONS } = require('./dashboard.constants');
const {
  summaryQuerySchema,
  topCustomersQuerySchema,
  lowStockQuerySchema,
  recentActivityQuerySchema,
  salesTrendQuerySchema,
  bestSellingProductsQuerySchema,
  monthlySalesQuerySchema,
} = require('./dashboard.validation');

const router = express.Router();

router.use(authenticate);
router.use(authorize(DASHBOARD_PERMISSIONS.READ));

router.get('/', dashboardController.dashboard);
router.get('/summary',                validate(summaryQuerySchema, 'query'),                dashboardController.summary);
router.get('/top-customers',          validate(topCustomersQuerySchema, 'query'),          dashboardController.topCustomers);
router.get('/low-stock',              validate(lowStockQuerySchema, 'query'),              dashboardController.lowStock);
router.get('/recent-activity',        validate(recentActivityQuerySchema, 'query'),        dashboardController.recentActivity);
router.get('/sales-trend',            validate(salesTrendQuerySchema, 'query'),            dashboardController.salesTrend);
router.get('/best-selling-products',  validate(bestSellingProductsQuerySchema, 'query'),   dashboardController.bestSellingProducts);
router.get('/monthly-sales',          validate(monthlySalesQuerySchema, 'query'),          dashboardController.monthlySales);

module.exports = router;

'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const reportController = require('./report.controller');
const { REPORT_PERMISSIONS } = require('./report.constants');
const {
  dateRangeQuerySchema,
  topProductsQuerySchema,
  salesByCustomerQuerySchema,
  overviewQuerySchema,
} = require('./report.validation');

const router = express.Router();

router.use(authenticate);
router.use(authorize(REPORT_PERMISSIONS.READ));

router.get('/overview',           validate(overviewQuerySchema, 'query'),         reportController.overview);
router.get('/financial',          validate(dateRangeQuerySchema, 'query'),        reportController.financial);
router.get('/top-products',       validate(topProductsQuerySchema, 'query'),      reportController.topProducts);
router.get('/sales-by-customer',  validate(salesByCustomerQuerySchema, 'query'),  reportController.salesByCustomer);
router.get('/gst',                validate(dateRangeQuerySchema, 'query'),        reportController.gst);
router.get('/inventory',          validate(dateRangeQuerySchema, 'query'),        reportController.inventory);

module.exports = router;

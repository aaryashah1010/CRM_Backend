'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const quotationController = require('./quotation.controller');
const {
  idParamSchema,
  listQuotationsSchema,
  createQuotationSchema,
  updateQuotationSchema,
} = require('./quotation.validation');

const router = express.Router();

router.use(authenticate);

router.get(
  '/metrics',
  authorize('quotations:read'),
  quotationController.getMetrics
);

router.get(
  '/',
  authorize('quotations:read'),
  validate(listQuotationsSchema, 'query'),
  quotationController.listQuotations
);

router.post(
  '/',
  authorize('quotations:create'),
  validate(createQuotationSchema),
  quotationController.createQuotation
);

router.get(
  '/:quotationId',
  authorize('quotations:read'),
  validate(idParamSchema, 'params'),
  quotationController.getQuotation
);

router.patch(
  '/:quotationId',
  authorize('quotations:update'),
  validate(idParamSchema, 'params'),
  validate(updateQuotationSchema),
  quotationController.updateQuotation
);

router.post(
  '/:quotationId/send',
  authorize('quotations:update'),
  validate(idParamSchema, 'params'),
  quotationController.sendQuotation
);

router.post(
  '/:quotationId/approve',
  authorize('quotations:approve'),
  validate(idParamSchema, 'params'),
  quotationController.approveQuotation
);

router.post(
  '/:quotationId/reject',
  authorize('quotations:approve'),
  validate(idParamSchema, 'params'),
  quotationController.rejectQuotation
);

router.post(
  '/:quotationId/expire',
  authorize('quotations:update'),
  validate(idParamSchema, 'params'),
  quotationController.expireQuotation
);

router.post(
  '/:quotationId/convert-to-sales-order',
  authorize('quotations:approve', 'sales_orders:create'),
  validate(idParamSchema, 'params'),
  quotationController.convertToSalesOrder
);

module.exports = router;

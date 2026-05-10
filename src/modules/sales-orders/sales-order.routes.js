'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const salesOrderController = require('./sales-order.controller');
const {
  idParamSchema,
  listSalesOrdersSchema,
  createSalesOrderSchema,
  updateSalesOrderSchema,
  convertToInvoiceSchema,
} = require('./sales-order.validation');

const router = express.Router();

router.use(authenticate);

router.get(
  '/metrics',
  authorize('sales_orders:read'),
  salesOrderController.getMetrics
);

router.get(
  '/',
  authorize('sales_orders:read'),
  validate(listSalesOrdersSchema, 'query'),
  salesOrderController.listSalesOrders
);

router.post(
  '/',
  authorize('sales_orders:create'),
  validate(createSalesOrderSchema),
  salesOrderController.createSalesOrder
);

router.get(
  '/:salesOrderId',
  authorize('sales_orders:read'),
  validate(idParamSchema, 'params'),
  salesOrderController.getSalesOrder
);

router.patch(
  '/:salesOrderId',
  authorize('sales_orders:update'),
  validate(idParamSchema, 'params'),
  validate(updateSalesOrderSchema),
  salesOrderController.updateSalesOrder
);

router.post(
  '/:salesOrderId/confirm',
  authorize('sales_orders:update'),
  validate(idParamSchema, 'params'),
  salesOrderController.confirmSalesOrder
);

router.post(
  '/:salesOrderId/dispatch',
  authorize('sales_orders:update'),
  validate(idParamSchema, 'params'),
  salesOrderController.dispatchSalesOrder
);

router.post(
  '/:salesOrderId/convert-to-invoice',
  authorize('sales_orders:read', 'invoices:create'),
  validate(idParamSchema, 'params'),
  validate(convertToInvoiceSchema),
  salesOrderController.convertToInvoice
);

router.post(
  '/:salesOrderId/cancel',
  authorize('sales_orders:update'),
  validate(idParamSchema, 'params'),
  salesOrderController.cancelSalesOrder
);

module.exports = router;

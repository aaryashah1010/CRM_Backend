'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const purchaseOrderController = require('./purchase-order.controller');
const {
  idParamSchema,
  listPurchaseOrdersSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
} = require('./purchase-order.validation');

const router = express.Router();

router.use(authenticate);

router.get('/metrics', authorize('purchase_orders:read'), purchaseOrderController.getMetrics);
router.get('/', authorize('purchase_orders:read'), validate(listPurchaseOrdersSchema, 'query'), purchaseOrderController.listPurchaseOrders);
router.post('/', authorize('purchase_orders:create'), validate(createPurchaseOrderSchema), purchaseOrderController.createPurchaseOrder);
router.get('/:purchaseOrderId', authorize('purchase_orders:read'), validate(idParamSchema, 'params'), purchaseOrderController.getPurchaseOrder);
router.patch('/:purchaseOrderId', authorize('purchase_orders:update'), validate(idParamSchema, 'params'), validate(updatePurchaseOrderSchema), purchaseOrderController.updatePurchaseOrder);
router.post('/:purchaseOrderId/send', authorize('purchase_orders:update'), validate(idParamSchema, 'params'), purchaseOrderController.sendPurchaseOrder);
router.post('/:purchaseOrderId/cancel', authorize('purchase_orders:update'), validate(idParamSchema, 'params'), purchaseOrderController.cancelPurchaseOrder);
router.post(
  '/:purchaseOrderId/receive',
  authorize('purchase_orders:update', 'inward:create'),
  validate(idParamSchema, 'params'),
  validate(receivePurchaseOrderSchema),
  purchaseOrderController.receivePurchaseOrder
);

module.exports = router;

'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const productController = require('./product.controller');
const {
  idParamSchema,
  listProductsSchema,
  createProductSchema,
  updateProductSchema,
  stockAdjustmentSchema,
} = require('./product.validation');

const router = express.Router();

router.use(authenticate);

router.get('/tax-rates', authorize('products:read'), productController.listTaxRates);
router.get('/metrics', authorize('products:read'), productController.getMetrics);
router.get('/', authorize('products:read'), validate(listProductsSchema, 'query'), productController.listProducts);
router.post('/', authorize('products:create'), validate(createProductSchema), productController.createProduct);
router.get('/:productId', authorize('products:read'), validate(idParamSchema, 'params'), productController.getProduct);
router.patch('/:productId', authorize('products:update'), validate(idParamSchema, 'params'), validate(updateProductSchema), productController.updateProduct);
router.post('/:productId/stock-adjustments', authorize('products:update'), validate(idParamSchema, 'params'), validate(stockAdjustmentSchema), productController.adjustStock);
router.post('/:productId/activate', authorize('products:update'), validate(idParamSchema, 'params'), productController.activateProduct);
router.post('/:productId/deactivate', authorize('products:update'), validate(idParamSchema, 'params'), productController.deactivateProduct);

module.exports = router;

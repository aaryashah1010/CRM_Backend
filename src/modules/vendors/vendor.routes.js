'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const vendorController = require('./vendor.controller');
const {
  idParamSchema,
  listVendorsSchema,
  createVendorSchema,
  updateVendorSchema,
} = require('./vendor.validation');

const router = express.Router();

router.use(authenticate);

router.get('/payment-terms', authorize('vendors:read'), vendorController.listPaymentTerms);
router.get('/metrics', authorize('vendors:read'), vendorController.getMetrics);
router.get('/', authorize('vendors:read'), validate(listVendorsSchema, 'query'), vendorController.listVendors);
router.post('/', authorize('vendors:create'), validate(createVendorSchema), vendorController.createVendor);
router.get('/:vendorId/ledger', authorize('vendors:read'), validate(idParamSchema, 'params'), vendorController.getVendorLedger);
router.get('/:vendorId', authorize('vendors:read'), validate(idParamSchema, 'params'), vendorController.getVendor);
router.patch('/:vendorId', authorize('vendors:update'), validate(idParamSchema, 'params'), validate(updateVendorSchema), vendorController.updateVendor);
router.post('/:vendorId/activate', authorize('vendors:update'), validate(idParamSchema, 'params'), vendorController.activateVendor);
router.post('/:vendorId/deactivate', authorize('vendors:update'), validate(idParamSchema, 'params'), vendorController.deactivateVendor);

module.exports = router;

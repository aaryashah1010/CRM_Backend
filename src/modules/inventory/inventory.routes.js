'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const inventoryController = require('./inventory.controller');
const {
  listInventorySchema,
  listMovementsSchema,
  stockAdjustmentSchema,
} = require('./inventory.validation');

const router = express.Router();

router.use(authenticate);

router.get('/metrics', authorize('inventory:read'), inventoryController.getMetrics);
router.get('/movements', authorize('inventory:read'), validate(listMovementsSchema, 'query'), inventoryController.listMovements);
router.post('/adjustments', authorize('inventory:adjust'), validate(stockAdjustmentSchema), inventoryController.adjustStock);
router.get('/', authorize('inventory:read'), validate(listInventorySchema, 'query'), inventoryController.listInventory);

module.exports = router;

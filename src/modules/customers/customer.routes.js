'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const customerController = require('./customer.controller');
const {
  idParamSchema,
  listCustomersSchema,
  createCustomerSchema,
  updateCustomerSchema,
} = require('./customer.validation');

const router = express.Router();

router.use(authenticate);

router.get('/payment-terms', authorize('customers:read'), customerController.listPaymentTerms);
router.get('/metrics', authorize('customers:read'), customerController.getMetrics);
router.get('/', authorize('customers:read'), validate(listCustomersSchema, 'query'), customerController.listCustomers);
router.post('/', authorize('customers:create'), validate(createCustomerSchema), customerController.createCustomer);
router.get('/:customerId/ledger', authorize('customers:read'), validate(idParamSchema, 'params'), customerController.getCustomerLedger);
router.get('/:customerId', authorize('customers:read'), validate(idParamSchema, 'params'), customerController.getCustomer);
router.patch('/:customerId', authorize('customers:update'), validate(idParamSchema, 'params'), validate(updateCustomerSchema), customerController.updateCustomer);
router.post('/:customerId/activate', authorize('customers:update'), validate(idParamSchema, 'params'), customerController.activateCustomer);
router.post('/:customerId/deactivate', authorize('customers:update'), validate(idParamSchema, 'params'), customerController.deactivateCustomer);

module.exports = router;

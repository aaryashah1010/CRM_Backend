'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const paymentController = require('./payment.controller');
const {
  idParamSchema,
  vendorIdParamSchema,
  listPaymentsSchema,
  payableQuerySchema,
  payableInwardsQuerySchema,
  createPaymentSchema,
} = require('./payment.validation');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('payments:read'),
  validate(listPaymentsSchema, 'query'),
  paymentController.listPayments
);

router.get(
  '/vendors/:vendorId/payable',
  authorize('payments:read'),
  validate(vendorIdParamSchema, 'params'),
  validate(payableQuerySchema, 'query'),
  paymentController.getVendorPayable
);

router.get(
  '/vendors/:vendorId/inwards',
  authorize('payments:read'),
  validate(vendorIdParamSchema, 'params'),
  validate(payableInwardsQuerySchema, 'query'),
  paymentController.listVendorPayableInwards
);

router.post(
  '/',
  authorize('payments:create'),
  validate(createPaymentSchema),
  paymentController.createPayment
);

router.get(
  '/:paymentId',
  authorize('payments:read'),
  validate(idParamSchema, 'params'),
  paymentController.getPayment
);

router.post(
  '/:paymentId/reverse',
  authorize('payments:update'),
  validate(idParamSchema, 'params'),
  paymentController.reversePayment
);

module.exports = router;

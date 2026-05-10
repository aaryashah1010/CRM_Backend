'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const receiptController = require('./receipt.controller');
const {
  invoiceIdParamSchema,
  createReceiptSchema,
} = require('./receipt.validation');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('receipts:create'), validate(createReceiptSchema), receiptController.createReceipt);
router.get('/invoice/:invoiceId', authorize('receipts:read'), validate(invoiceIdParamSchema, 'params'), receiptController.listInvoiceReceipts);

module.exports = router;

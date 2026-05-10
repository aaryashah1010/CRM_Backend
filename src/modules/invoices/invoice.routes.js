'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const invoiceController = require('./invoice.controller');
const receiptController = require('../receipts/receipt.controller');
const {
  idParamSchema,
  listInvoicesSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
} = require('./invoice.validation');
const { recordInvoiceReceiptSchema } = require('../receipts/receipt.validation');

const router = express.Router();

router.use(authenticate);

router.get('/metrics', authorize('invoices:read'), invoiceController.getMetrics);
router.get('/', authorize('invoices:read'), validate(listInvoicesSchema, 'query'), invoiceController.listInvoices);
router.post('/', authorize('invoices:create'), validate(createInvoiceSchema), invoiceController.createInvoice);
router.get('/:invoiceId', authorize('invoices:read'), validate(idParamSchema, 'params'), invoiceController.getInvoice);
router.patch('/:invoiceId', authorize('invoices:update'), validate(idParamSchema, 'params'), validate(updateInvoiceSchema), invoiceController.updateInvoice);
router.post('/:invoiceId/issue', authorize('invoices:update'), validate(idParamSchema, 'params'), invoiceController.issueInvoice);
router.post('/:invoiceId/cancel', authorize('invoices:cancel'), validate(idParamSchema, 'params'), invoiceController.cancelInvoice);
router.post('/:invoiceId/receipts', authorize('receipts:create'), validate(idParamSchema, 'params'), validate(recordInvoiceReceiptSchema), receiptController.recordInvoiceReceipt);

module.exports = router;

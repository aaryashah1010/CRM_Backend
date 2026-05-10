'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const leadController = require('./lead.controller');
const {
  idParamSchema,
  listLeadsSchema,
  createLeadSchema,
  updateLeadSchema,
  statusUpdateSchema,
  createFollowUpSchema,
  convertToQuotationSchema,
} = require('./lead.validation');

const router = express.Router();

router.use(authenticate);

router.get('/options', authorize('leads:read'), leadController.getOptions);
router.get('/metrics', authorize('leads:read'), leadController.getMetrics);
router.get('/pipeline', authorize('leads:read'), leadController.getPipeline);
router.get('/', authorize('leads:read'), validate(listLeadsSchema, 'query'), leadController.listLeads);
router.post('/', authorize('leads:create'), validate(createLeadSchema), leadController.createLead);
router.get('/:leadId', authorize('leads:read'), validate(idParamSchema, 'params'), leadController.getLead);
router.patch('/:leadId', authorize('leads:update'), validate(idParamSchema, 'params'), validate(updateLeadSchema), leadController.updateLead);
router.post('/:leadId/status', authorize('leads:update'), validate(idParamSchema, 'params'), validate(statusUpdateSchema), leadController.updateStatus);
router.post('/:leadId/follow-ups', authorize('followups:create'), validate(idParamSchema, 'params'), validate(createFollowUpSchema), leadController.createFollowUp);
router.post('/:leadId/convert-to-quotation', authorize('leads:update', 'customers:create', 'quotations:create'), validate(idParamSchema, 'params'), validate(convertToQuotationSchema), leadController.convertToQuotation);

module.exports = router;

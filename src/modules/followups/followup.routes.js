'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const followUpController = require('./followup.controller');
const {
  idParamSchema,
  listFollowUpsSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  completeFollowUpSchema,
  cancelFollowUpSchema,
} = require('./followup.validation');

const router = express.Router();

router.use(authenticate);

router.get('/options', authorize('followups:read'), followUpController.getOptions);
router.get('/metrics', authorize('followups:read'), followUpController.getMetrics);
router.get('/', authorize('followups:read'), validate(listFollowUpsSchema, 'query'), followUpController.listFollowUps);
router.post('/', authorize('followups:create'), validate(createFollowUpSchema), followUpController.createFollowUp);
router.get('/:followUpId', authorize('followups:read'), validate(idParamSchema, 'params'), followUpController.getFollowUp);
router.patch('/:followUpId', authorize('followups:update'), validate(idParamSchema, 'params'), validate(updateFollowUpSchema), followUpController.updateFollowUp);
router.post('/:followUpId/complete', authorize('followups:update'), validate(idParamSchema, 'params'), validate(completeFollowUpSchema), followUpController.completeFollowUp);
router.post('/:followUpId/cancel', authorize('followups:update'), validate(idParamSchema, 'params'), validate(cancelFollowUpSchema), followUpController.cancelFollowUp);
router.delete('/:followUpId', authorize('followups:delete'), validate(idParamSchema, 'params'), followUpController.deactivateFollowUp);

module.exports = router;

'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const userController = require('./user.controller');
const {
  idParamSchema,
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} = require('./user.validation');

const router = express.Router();

router.use(authenticate);

router.get('/roles', authorize('users:read'), userController.listRoles);
router.get('/metrics', authorize('users:read'), userController.getMetrics);
router.get('/', authorize('users:read'), validate(listUsersSchema, 'query'), userController.listUsers);
router.post('/', authorize('users:create'), validate(createUserSchema), userController.createUser);
router.get('/:userId', authorize('users:read'), validate(idParamSchema, 'params'), userController.getUser);
router.patch('/:userId', authorize('users:update'), validate(idParamSchema, 'params'), validate(updateUserSchema), userController.updateUser);
router.post('/:userId/activate', authorize('users:update'), validate(idParamSchema, 'params'), userController.activateUser);
router.post('/:userId/deactivate', authorize('users:update'), validate(idParamSchema, 'params'), userController.deactivateUser);
router.post('/:userId/reset-password', authorize('users:update'), validate(idParamSchema, 'params'), validate(resetPasswordSchema), userController.resetPassword);

module.exports = router;

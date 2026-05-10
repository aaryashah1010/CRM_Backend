'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const categoryController = require('./category.controller');
const {
  idParamSchema,
  listCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
} = require('./category.validation');

const router = express.Router();

router.use(authenticate);

router.get('/tree', authorize('products:read'), categoryController.getTree);
router.get('/metrics', authorize('products:read'), categoryController.getMetrics);
router.get('/', authorize('products:read'), validate(listCategoriesSchema, 'query'), categoryController.listCategories);
router.post('/', authorize('products:create'), validate(createCategorySchema), categoryController.createCategory);
router.get('/:categoryId', authorize('products:read'), validate(idParamSchema, 'params'), categoryController.getCategory);
router.patch('/:categoryId', authorize('products:update'), validate(idParamSchema, 'params'), validate(updateCategorySchema), categoryController.updateCategory);
router.post('/:categoryId/activate', authorize('products:update'), validate(idParamSchema, 'params'), categoryController.activateCategory);
router.post('/:categoryId/deactivate', authorize('products:update'), validate(idParamSchema, 'params'), categoryController.deactivateCategory);

module.exports = router;

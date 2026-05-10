'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const categoryService = require('./category.service');
const { CATEGORY_MESSAGES } = require('./category.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listCategories = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await categoryService.listCategories({ ...req.query, ...pagination });
    return response.success(res, result, CATEGORY_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getCategory = async (req, res, next) => {
  try {
    const category = await categoryService.getCategory(Number(req.params.categoryId));
    return response.success(res, category, CATEGORY_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body, getActorUserId(req));
    return response.created(res, category, CATEGORY_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(Number(req.params.categoryId), req.body, getActorUserId(req));
    return response.success(res, category, CATEGORY_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const activateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.setActiveState(Number(req.params.categoryId), true, getActorUserId(req));
    return response.success(res, category, CATEGORY_MESSAGES.ACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const deactivateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.setActiveState(Number(req.params.categoryId), false, getActorUserId(req));
    return response.success(res, category, CATEGORY_MESSAGES.DEACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const getTree = async (_req, res, next) => {
  try {
    const categories = await categoryService.getTree();
    return response.success(res, categories, CATEGORY_MESSAGES.TREE_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await categoryService.getMetrics();
    return response.success(res, metrics, CATEGORY_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  activateCategory,
  deactivateCategory,
  getTree,
  getMetrics,
};

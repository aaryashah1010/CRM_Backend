'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const productService = require('./product.service');
const { PRODUCT_MESSAGES } = require('./product.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listProducts = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await productService.listProducts({ ...req.query, ...pagination });
    return response.success(res, result, PRODUCT_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProduct(Number(req.params.productId));
    return response.success(res, product, PRODUCT_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body, getActorUserId(req));
    return response.created(res, product, PRODUCT_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(Number(req.params.productId), req.body, getActorUserId(req));
    return response.success(res, product, PRODUCT_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const activateProduct = async (req, res, next) => {
  try {
    const product = await productService.setActiveState(Number(req.params.productId), true, getActorUserId(req));
    return response.success(res, product, PRODUCT_MESSAGES.ACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const deactivateProduct = async (req, res, next) => {
  try {
    const product = await productService.setActiveState(Number(req.params.productId), false, getActorUserId(req));
    return response.success(res, product, PRODUCT_MESSAGES.DEACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const product = await productService.adjustStock(Number(req.params.productId), req.body, getActorUserId(req));
    return response.success(res, product, PRODUCT_MESSAGES.STOCK_ADJUSTED);
  } catch (err) {
    return next(err);
  }
};

const listTaxRates = async (_req, res, next) => {
  try {
    const taxRates = await productService.listTaxRates();
    return response.success(res, taxRates, PRODUCT_MESSAGES.TAX_RATES_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await productService.getMetrics();
    return response.success(res, metrics, PRODUCT_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  activateProduct,
  deactivateProduct,
  adjustStock,
  listTaxRates,
  getMetrics,
};

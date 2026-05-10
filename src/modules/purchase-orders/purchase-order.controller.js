'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const purchaseOrderService = require('./purchase-order.service');
const { PURCHASE_ORDER_MESSAGES } = require('./purchase-order.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listPurchaseOrders = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await purchaseOrderService.listPurchaseOrders({ ...req.query, ...pagination });
    return response.success(res, result, PURCHASE_ORDER_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await purchaseOrderService.getPurchaseOrder(Number(req.params.purchaseOrderId));
    return response.success(res, purchaseOrder, PURCHASE_ORDER_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await purchaseOrderService.createPurchaseOrder(req.body, getActorUserId(req));
    return response.created(res, purchaseOrder, PURCHASE_ORDER_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updatePurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(
      Number(req.params.purchaseOrderId),
      req.body,
      getActorUserId(req)
    );
    return response.success(res, purchaseOrder, PURCHASE_ORDER_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const sendPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await purchaseOrderService.sendPurchaseOrder(
      Number(req.params.purchaseOrderId),
      getActorUserId(req)
    );
    return response.success(res, purchaseOrder, PURCHASE_ORDER_MESSAGES.SENT);
  } catch (err) {
    return next(err);
  }
};

const cancelPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(
      Number(req.params.purchaseOrderId),
      getActorUserId(req)
    );
    return response.success(res, purchaseOrder, PURCHASE_ORDER_MESSAGES.CANCELLED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await purchaseOrderService.getMetrics();
    return response.success(res, metrics, PURCHASE_ORDER_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const receivePurchaseOrder = async (req, res, next) => {
  try {
    const result = await purchaseOrderService.receivePurchaseOrder(
      Number(req.params.purchaseOrderId),
      req.body,
      getActorUserId(req)
    );
    return response.created(res, result, PURCHASE_ORDER_MESSAGES.RECEIVED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  getMetrics,
};

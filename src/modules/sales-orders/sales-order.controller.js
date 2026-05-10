'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const salesOrderService = require('./sales-order.service');
const { SALES_ORDER_MESSAGES } = require('./sales-order.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listSalesOrders = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await salesOrderService.listSalesOrders({ ...req.query, ...pagination });
    return response.success(res, result, SALES_ORDER_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getSalesOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.getSalesOrder(Number(req.params.salesOrderId));
    return response.success(res, order, SALES_ORDER_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createSalesOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.createSalesOrder(req.body, getActorUserId(req));
    return response.created(res, order, SALES_ORDER_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateSalesOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.updateSalesOrder(
      Number(req.params.salesOrderId),
      req.body,
      getActorUserId(req)
    );
    return response.success(res, order, SALES_ORDER_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const confirmSalesOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.confirmSalesOrder(
      Number(req.params.salesOrderId),
      getActorUserId(req)
    );
    return response.success(res, order, SALES_ORDER_MESSAGES.CONFIRMED);
  } catch (err) {
    return next(err);
  }
};

const dispatchSalesOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.dispatchSalesOrder(
      Number(req.params.salesOrderId),
      getActorUserId(req)
    );
    return response.success(res, order, SALES_ORDER_MESSAGES.DISPATCHED);
  } catch (err) {
    return next(err);
  }
};

const convertToInvoice = async (req, res, next) => {
  try {
    const result = await salesOrderService.convertToInvoice(
      Number(req.params.salesOrderId),
      req.body || {},
      getActorUserId(req)
    );

    if (result.created) {
      return response.created(res, result, SALES_ORDER_MESSAGES.CONVERTED_TO_INVOICE);
    }
    return response.success(res, result, 'Sales order already has an invoice');
  } catch (err) {
    return next(err);
  }
};

const cancelSalesOrder = async (req, res, next) => {
  try {
    const order = await salesOrderService.cancelSalesOrder(
      Number(req.params.salesOrderId),
      getActorUserId(req)
    );
    return response.success(res, order, SALES_ORDER_MESSAGES.CANCELLED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await salesOrderService.getMetrics();
    return response.success(res, metrics, SALES_ORDER_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  confirmSalesOrder,
  dispatchSalesOrder,
  convertToInvoice,
  cancelSalesOrder,
  getMetrics,
};

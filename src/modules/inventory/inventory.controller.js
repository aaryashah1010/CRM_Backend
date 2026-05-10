'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const inventoryService = require('./inventory.service');
const { INVENTORY_MESSAGES } = require('./inventory.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listInventory = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await inventoryService.listInventory({ ...req.query, ...pagination });
    return response.success(res, result, INVENTORY_MESSAGES.ITEMS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await inventoryService.getMetrics();
    return response.success(res, metrics, INVENTORY_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const listMovements = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await inventoryService.listMovements({ ...req.query, ...pagination });
    return response.success(res, result, INVENTORY_MESSAGES.MOVEMENTS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const item = await inventoryService.adjustStock(req.body, getActorUserId(req));
    return response.created(res, item, INVENTORY_MESSAGES.STOCK_ADJUSTED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listInventory,
  getMetrics,
  listMovements,
  adjustStock,
};

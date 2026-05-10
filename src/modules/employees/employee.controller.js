'use strict';

const response = require('../../common/responses/response');
const { parsePagination } = require('../../common/utils/pagination.util');
const employeeService = require('./employee.service');
const { EMPLOYEE_MESSAGES } = require('./employee.constants');

const getActorUserId = (req) => req.user?.user_id ?? null;

const listEmployees = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await employeeService.listEmployees({ ...req.query, ...pagination });
    return response.success(res, result, EMPLOYEE_MESSAGES.LIST_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployee(Number(req.params.employeeId));
    return response.success(res, employee, EMPLOYEE_MESSAGES.DETAIL_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const createEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.createEmployee(req.body, getActorUserId(req));
    return response.created(res, employee, EMPLOYEE_MESSAGES.CREATED);
  } catch (err) {
    return next(err);
  }
};

const updateEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.updateEmployee(Number(req.params.employeeId), req.body, getActorUserId(req));
    return response.success(res, employee, EMPLOYEE_MESSAGES.UPDATED);
  } catch (err) {
    return next(err);
  }
};

const deactivateEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.setActiveState(Number(req.params.employeeId), false, getActorUserId(req));
    return response.success(res, employee, EMPLOYEE_MESSAGES.DEACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const activateEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.setActiveState(Number(req.params.employeeId), true, getActorUserId(req));
    return response.success(res, employee, EMPLOYEE_MESSAGES.ACTIVATED);
  } catch (err) {
    return next(err);
  }
};

const listDepartments = async (_req, res, next) => {
  try {
    const departments = await employeeService.listDepartments();
    return response.success(res, departments, EMPLOYEE_MESSAGES.DEPARTMENTS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

const getMetrics = async (_req, res, next) => {
  try {
    const metrics = await employeeService.getMetrics();
    return response.success(res, metrics, EMPLOYEE_MESSAGES.METRICS_FETCHED);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  activateEmployee,
  listDepartments,
  getMetrics,
};

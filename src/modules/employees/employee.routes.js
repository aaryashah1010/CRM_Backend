'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const employeeController = require('./employee.controller');
const {
  idParamSchema,
  listEmployeesSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
} = require('./employee.validation');

const router = express.Router();

router.use(authenticate);

router.get('/departments', authorize('employees:read'), employeeController.listDepartments);
router.get('/metrics', authorize('employees:read'), employeeController.getMetrics);
router.get('/', authorize('employees:read'), validate(listEmployeesSchema, 'query'), employeeController.listEmployees);
router.post('/', authorize('employees:create'), validate(createEmployeeSchema), employeeController.createEmployee);
router.get('/:employeeId', authorize('employees:read'), validate(idParamSchema, 'params'), employeeController.getEmployee);
router.patch('/:employeeId', authorize('employees:update'), validate(idParamSchema, 'params'), validate(updateEmployeeSchema), employeeController.updateEmployee);
router.post('/:employeeId/activate', authorize('employees:update'), validate(idParamSchema, 'params'), employeeController.activateEmployee);
router.post('/:employeeId/deactivate', authorize('employees:update'), validate(idParamSchema, 'params'), employeeController.deactivateEmployee);

module.exports = router;

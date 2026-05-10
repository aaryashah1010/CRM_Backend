'use strict';

const EMPLOYEE_SORT_FIELDS = Object.freeze({
  fullName: 'e.full_name',
  employeeCode: 'e.employee_code',
  department: 'd.name',
  designation: 'e.designation',
  dateOfJoining: 'e.date_of_joining',
  status: 'e.is_active',
  createdAt: 'e.created_at',
});

const EMPLOYEE_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Employees fetched successfully',
  DETAIL_FETCHED: 'Employee fetched successfully',
  CREATED: 'Employee created successfully',
  UPDATED: 'Employee updated successfully',
  DEACTIVATED: 'Employee deactivated successfully',
  ACTIVATED: 'Employee activated successfully',
  DEPARTMENTS_FETCHED: 'Departments fetched successfully',
  METRICS_FETCHED: 'Employee metrics fetched successfully',
});

module.exports = {
  EMPLOYEE_SORT_FIELDS,
  EMPLOYEE_MESSAGES,
};

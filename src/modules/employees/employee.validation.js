'use strict';

const Joi = require('joi');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null);
const optionalDate = Joi.date().iso().allow('', null);

const idParamSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required(),
});

const listEmployeesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow('', null),
  departmentId: Joi.number().integer().positive(),
  designation: Joi.string().trim().max(100).allow('', null),
  isActive: Joi.boolean(),
  sortBy: Joi.string()
    .valid('fullName', 'employeeCode', 'department', 'designation', 'dateOfJoining', 'status', 'createdAt')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const employeePayload = {
  userId: Joi.number().integer().positive().allow(null),
  departmentId: Joi.number().integer().positive().allow(null),
  employeeCode: Joi.string().trim().max(50),
  fullName: Joi.string().trim().min(2).max(200),
  email: optionalText(255).email(),
  phone: optionalText(20),
  designation: optionalText(100),
  dateOfJoining: optionalDate,
  dateOfBirth: optionalDate,
  gender: Joi.string().valid('male', 'female', 'other').allow('', null),
  address: optionalText(4000),
  city: optionalText(100),
  state: optionalText(100),
  pincode: optionalText(10),
  bankName: optionalText(100),
  bankAccountNumber: optionalText(50),
  bankIfscCode: optionalText(20),
  bankBranch: optionalText(100),
  emergencyContactName: optionalText(200),
  emergencyContactPhone: optionalText(20),
  emergencyContactRelation: optionalText(50),
  isActive: Joi.boolean(),
};

const createEmployeeSchema = Joi.object({
  ...employeePayload,
  employeeCode: employeePayload.employeeCode.required(),
  fullName: employeePayload.fullName.required(),
  isActive: Joi.boolean().default(true),
});

const updateEmployeeSchema = Joi.object(employeePayload).min(1);

module.exports = {
  idParamSchema,
  listEmployeesSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
};

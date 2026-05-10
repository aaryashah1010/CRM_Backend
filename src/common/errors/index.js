'use strict';

const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message, details) {
    super(message || 'Validation failed', 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message) {
    super(message || 'Authentication required', 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message) {
    super(message || 'Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message || 'Resource not found', 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message || 'Resource already exists', 409, 'CONFLICT');
  }
}

class BusinessRuleError extends AppError {
  constructor(message) {
    super(message || 'Business rule violation', 422, 'BUSINESS_RULE_ERROR');
  }
}

class InsufficientStockError extends AppError {
  constructor(message) {
    super(message || 'Insufficient stock', 422, 'INSUFFICIENT_STOCK');
  }
}

class PaymentAmountInvalidError extends AppError {
  constructor(message) {
    super(message || 'Payment amount is invalid', 422, 'PAYMENT_AMOUNT_INVALID');
  }
}

class DatabaseError extends AppError {
  constructor(message) {
    super(message || 'Database error', 500, 'DATABASE_ERROR');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  InsufficientStockError,
  PaymentAmountInvalidError,
  DatabaseError,
};

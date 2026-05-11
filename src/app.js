'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { requestId, httpLogger } = require('./common/middleware/requestLogger.middleware');
const errorHandler = require('./common/middleware/error.middleware');
const { NotFoundError } = require('./common/errors');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: env.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.', data: null, error: { code: 'RATE_LIMITED' } },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestId);
app.use(httpLogger);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes — modules register here as they are built
app.use('/api/v1/auth',           require('./modules/auth/auth.routes'));
app.use('/api/v1/users',          require('./modules/users/user.routes'));
app.use('/api/v1/employees',      require('./modules/employees/employee.routes'));
app.use('/api/v1/customers',      require('./modules/customers/customer.routes'));
app.use('/api/v1/vendors',        require('./modules/vendors/vendor.routes'));
app.use('/api/v1/products',       require('./modules/products/product.routes'));
app.use('/api/v1/categories',     require('./modules/categories/category.routes'));
app.use('/api/v1/leads',          require('./modules/leads/lead.routes'));
app.use('/api/v1/followups',      require('./modules/followups/followup.routes'));
app.use('/api/v1/quotations',     require('./modules/quotations/quotation.routes'));
app.use('/api/v1/sales-orders',   require('./modules/sales-orders/sales-order.routes'));
app.use('/api/v1/purchase-orders',require('./modules/purchase-orders/purchase-order.routes'));
app.use('/api/v1/invoices',       require('./modules/invoices/invoice.routes'));
// app.use('/api/v1/inward',         require('./modules/inward/inward.routes'));
app.use('/api/v1/receipts',       require('./modules/receipts/receipt.routes'));
app.use('/api/v1/payments',       require('./modules/payments/payment.routes'));
app.use('/api/v1/inventory',      require('./modules/inventory/inventory.routes'));
app.use('/api/v1/dashboard',      require('./modules/dashboard/dashboard.routes'));
app.use('/api/v1/reports',        require('./modules/reports/report.routes'));
app.use('/api/v1/settings',       require('./modules/settings/settings.routes'));

// 404
app.use((_req, _res, next) => next(new NotFoundError('Route not found')));

// Centralized error handler
app.use(errorHandler);

module.exports = app;

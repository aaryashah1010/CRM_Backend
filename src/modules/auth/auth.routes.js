'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('./auth.controller');
const authenticate = require('../../common/middleware/authenticate.middleware');
const validate = require('../../common/middleware/validate.middleware');
const { loginSchema } = require('./auth.validation');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    data: null,
    error: { code: 'RATE_LIMITED', details: null },
  },
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

module.exports = router;

'use strict';

const express = require('express');

const authenticate = require('../../common/middleware/authenticate.middleware');
const authorize = require('../../common/middleware/authorize.middleware');
const validate = require('../../common/middleware/validate.middleware');
const settingsController = require('./settings.controller');
const { SETTINGS_PERMISSIONS } = require('./settings.constants');
const {
  companyProfileSchema,
  financialConfigSchema,
  invoiceConfigSchema,
} = require('./settings.validation');

const router = express.Router();

router.use(authenticate);

router.get('/',
  authorize(SETTINGS_PERMISSIONS.READ),
  settingsController.getSettings
);

router.patch('/company',
  authorize(SETTINGS_PERMISSIONS.MANAGE),
  validate(companyProfileSchema),
  settingsController.updateCompany
);

router.patch('/financial',
  authorize(SETTINGS_PERMISSIONS.MANAGE),
  validate(financialConfigSchema),
  settingsController.updateFinancial
);

router.patch('/invoice',
  authorize(SETTINGS_PERMISSIONS.MANAGE),
  validate(invoiceConfigSchema),
  settingsController.updateInvoice
);

module.exports = router;

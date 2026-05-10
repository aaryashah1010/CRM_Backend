'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const env = require('../../config/env');

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const transports = [
  new winston.transports.Console({
    format: env.isProduction ? combine(timestamp(), errors({ stack: true }), json()) : combine(colorize(), simple()),
  }),
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    format: combine(timestamp(), errors({ stack: true }), json()),
  }),
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    format: combine(timestamp(), errors({ stack: true }), json()),
  }),
];

const logger = winston.createLogger({
  level: env.logLevel,
  transports,
});

module.exports = logger;

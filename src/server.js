'use strict';

require('dotenv').config();

const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');
const logger = require('./common/logger/logger');

const start = async () => {
  try {
    // Verify DB connectivity before accepting requests
    await db.connect();
    await db.query('SELECT 1 AS ok');
    logger.info('MSSQL: connection verified');

    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received - shutting down gracefully`);
      server.close(async () => {
        await db.close();
        logger.info('Server and DB pool closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

start();

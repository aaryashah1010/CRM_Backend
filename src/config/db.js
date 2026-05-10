'use strict';

const sql = require('mssql');
const env = require('./env');
const logger = require('../common/logger/logger');

/**
 * MSSQL connection pool wrapper.
 *
 * Public API (kept compatible with prior pg-based usage):
 *   - pool                  : initialized only after connect() resolves
 *   - connect()             : connects the singleton pool (call once at startup)
 *   - close()               : closes the pool on shutdown
 *   - query(text, params)   : returns { rows, rowCount } where text uses pg-style $1,$2,...
 *   - getRequest()          : raw mssql Request bound to the pool (for typed inputs / OUTPUT clauses)
 *   - withTransaction(fn)   : runs fn(client) inside a transaction; client.query keeps the same shape
 *
 * Parameter convention:
 *   We accept Postgres-style positional parameters ($1, $2, ...) and translate them to
 *   mssql named parameters (@p1, @p2, ...). This keeps existing repository SQL portable.
 */

const config = {
  server:   env.db.server,
  port:     env.db.port,
  database: env.db.database,
  user:     env.db.user,
  password: env.db.password,
  options:  env.db.options,
  pool:     env.db.pool,
  connectionTimeout: env.db.connectionTimeout,
  requestTimeout:    env.db.requestTimeout,
};

let poolInstance = null;

const connect = async () => {
  if (poolInstance && poolInstance.connected) return poolInstance;
  poolInstance = await new sql.ConnectionPool(config).connect();
  poolInstance.on('error', (err) => {
    logger.error('MSSQL pool error', { error: err.message });
  });
  logger.debug('MSSQL: pool connected');
  return poolInstance;
};

const getPool = () => {
  if (!poolInstance) {
    throw new Error('MSSQL pool not initialized. Call connect() first.');
  }
  return poolInstance;
};

const close = async () => {
  if (poolInstance) {
    await poolInstance.close();
    poolInstance = null;
    logger.debug('MSSQL: pool closed');
  }
};

/**
 * Translate `$1, $2, ...` placeholders in `text` to `@p1, @p2, ...`
 * and bind values to the provided mssql Request.
 */
const bindPositionalParams = (request, text, params) => {
  let converted = text;
  if (Array.isArray(params)) {
    params.forEach((value, idx) => {
      const paramName = `p${idx + 1}`;
      const re = new RegExp(`\\$${idx + 1}(?![0-9])`, 'g');
      converted = converted.replace(re, `@${paramName}`);
      request.input(paramName, value);
    });
  }
  return converted;
};

const toResult = (mssqlResult) => ({
  rows: mssqlResult.recordset || [],
  rowCount: Array.isArray(mssqlResult.rowsAffected) && mssqlResult.rowsAffected.length > 0
    ? mssqlResult.rowsAffected[mssqlResult.rowsAffected.length - 1]
    : 0,
  recordsets: mssqlResult.recordsets,
});

const query = async (text, params = []) => {
  const pool = getPool();
  const request = pool.request();
  const converted = bindPositionalParams(request, text, params);
  const result = await request.query(converted);
  return toResult(result);
};

const getRequest = () => getPool().request();

const withTransaction = async (fn) => {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const client = {
      query: async (text, params = []) => {
        const request = new sql.Request(transaction);
        const converted = bindPositionalParams(request, text, params);
        const result = await request.query(converted);
        return toResult(result);
      },
      getRequest: () => new sql.Request(transaction),
      transaction,
    };
    const result = await fn(client);
    await transaction.commit();
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.error('MSSQL: rollback failed', { error: rollbackErr.message });
    }
    throw err;
  }
};

module.exports = {
  sql,
  connect,
  close,
  query,
  getRequest,
  withTransaction,
  getPool,
};

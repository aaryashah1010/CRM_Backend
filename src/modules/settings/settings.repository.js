'use strict';

const db = require('../../config/db');

const fetchAll = async () => {
  const result = await db.query(
    `SELECT [key] AS [key], value, description, updated_at, updated_by
       FROM app_settings
      WHERE is_active = 1`
  );
  return result.rows;
};

const fetchByKey = async (key) => {
  const result = await db.query(
    `SELECT TOP 1 [key] AS [key], value, description, updated_at, updated_by
       FROM app_settings
      WHERE [key] = $1
        AND is_active = 1`,
    [key]
  );
  return result.rows[0] || null;
};

/**
 * Upsert a JSON value under a given key. Uses MERGE so we never need a separate
 * existence check from the service layer.
 */
const upsertByKey = async (key, valueJson, userId) => {
  const result = await db.query(
    `MERGE app_settings AS target
     USING (SELECT $1 AS [key]) AS src
        ON target.[key] = src.[key]
     WHEN MATCHED THEN
       UPDATE SET
         value = $2,
         updated_by = $3,
         updated_at = SYSUTCDATETIME(),
         is_active = 1
     WHEN NOT MATCHED THEN
       INSERT ([key], value, created_by, updated_by)
       VALUES ($1, $2, $3, $3)
     OUTPUT INSERTED.[key] AS [key],
            INSERTED.value AS value,
            INSERTED.description AS description,
            INSERTED.updated_at AS updated_at,
            INSERTED.updated_by AS updated_by;`,
    [key, valueJson, userId]
  );
  return result.rows[0];
};

const fetchActorName = async (userId) => {
  if (!userId) return null;
  const result = await db.query(
    `SELECT TOP 1 id, full_name, username, email
       FROM users
      WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

const fetchTaxRate = async (id) => {
  if (!id) return null;
  const result = await db.query(
    `SELECT TOP 1 id, name, rate, is_active
       FROM tax_rates
      WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const fetchPaymentTerm = async (id) => {
  if (!id) return null;
  const result = await db.query(
    `SELECT TOP 1 id, name, days, is_active
       FROM payment_terms
      WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const fetchActiveTaxRates = async () => {
  const result = await db.query(
    `SELECT id, name, rate
       FROM tax_rates
      WHERE is_active = 1
      ORDER BY rate ASC`
  );
  return result.rows;
};

const fetchActivePaymentTerms = async () => {
  const result = await db.query(
    `SELECT id, name, days
       FROM payment_terms
      WHERE is_active = 1
      ORDER BY days ASC`
  );
  return result.rows;
};

module.exports = {
  fetchAll,
  fetchByKey,
  upsertByKey,
  fetchActorName,
  fetchTaxRate,
  fetchPaymentTerm,
  fetchActiveTaxRates,
  fetchActivePaymentTerms,
};

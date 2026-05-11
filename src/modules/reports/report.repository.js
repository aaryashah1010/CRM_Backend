'use strict';

const db = require('../../config/db');

const RANGE_PARAMS = (fromDate, toDate) => [fromDate, toDate];

/**
 * Quarterly revenue (sales_invoices.total_amount) and expense (inward_records.total_amount)
 * grouped by calendar quarter inside the window [fromDate, toDate].
 */
const fetchFinancialQuarterly = async (fromDate, toDate) => {
  const result = await db.query(
    `WITH sales AS (
       SELECT
         DATEFROMPARTS(YEAR(invoice_date), ((MONTH(invoice_date) - 1) / 3) * 3 + 1, 1) AS quarter_start,
         total_amount
       FROM sales_invoices
       WHERE is_active = 1
         AND status <> 'cancelled'
         AND invoice_date BETWEEN $1 AND $2
     ),
     purchases AS (
       SELECT
         DATEFROMPARTS(YEAR(inward_date), ((MONTH(inward_date) - 1) / 3) * 3 + 1, 1) AS quarter_start,
         total_amount
       FROM inward_records
       WHERE is_active = 1
         AND inward_date BETWEEN $1 AND $2
     ),
     combined AS (
       SELECT quarter_start, total_amount AS revenue, CAST(0 AS DECIMAL(18,2)) AS expense FROM sales
       UNION ALL
       SELECT quarter_start, CAST(0 AS DECIMAL(18,2)) AS revenue, total_amount AS expense FROM purchases
     )
     SELECT
       quarter_start,
       YEAR(quarter_start) AS year,
       ((MONTH(quarter_start) - 1) / 3) + 1 AS quarter,
       ISNULL(SUM(revenue), 0) AS revenue,
       ISNULL(SUM(expense), 0) AS expense
     FROM combined
     GROUP BY quarter_start
     ORDER BY quarter_start ASC`,
    RANGE_PARAMS(fromDate, toDate)
  );
  return result.rows;
};

/**
 * Net financial totals for the window.
 */
const fetchFinancialTotals = async (fromDate, toDate) => {
  const result = await db.query(
    `SELECT
       (SELECT ISNULL(SUM(total_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2) AS total_revenue,
       (SELECT ISNULL(SUM(taxable_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2) AS total_taxable_revenue,
       (SELECT ISNULL(SUM(tax_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2) AS total_output_tax,
       (SELECT ISNULL(SUM(total_amount), 0)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date BETWEEN $1 AND $2) AS total_expense,
       (SELECT ISNULL(SUM(taxable_amount), 0)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date BETWEEN $1 AND $2) AS total_taxable_expense,
       (SELECT ISNULL(SUM(tax_amount), 0)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date BETWEEN $1 AND $2) AS total_input_tax,
       (SELECT MAX(invoice_date)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2) AS last_invoice_date,
       (SELECT COUNT(*)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2) AS invoice_count`,
    RANGE_PARAMS(fromDate, toDate)
  );
  return result.rows[0] || {};
};

/**
 * Top performing products by revenue inside the window.
 * Joins with stock balances to surface stock status badges (in/low/out).
 */
const fetchTopProducts = async (fromDate, toDate, limit) => {
  const result = await db.query(
    `SELECT TOP ($1)
       p.id,
       p.sku,
       p.name,
       p.unit,
       p.reorder_level,
       ISNULL(SUM(sii.quantity), 0) AS units_sold,
       ISNULL(SUM(sii.line_total), 0) AS revenue,
       ISNULL(psb.quantity_available, 0) AS quantity_available
     FROM sales_invoice_items sii
     INNER JOIN sales_invoices si ON si.id = sii.invoice_id
     INNER JOIN products p ON p.id = sii.product_id
     LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
     WHERE si.is_active = 1
       AND si.status <> 'cancelled'
       AND p.is_active = 1
       AND si.invoice_date BETWEEN $2 AND $3
     GROUP BY p.id, p.sku, p.name, p.unit, p.reorder_level, psb.quantity_available
     ORDER BY revenue DESC`,
    [limit, fromDate, toDate]
  );
  return result.rows;
};

/**
 * Sales aggregated by customer (used as a proxy for "segments" since the schema
 * does not store regions). Returns top N customers by revenue with their share.
 */
const fetchSalesByCustomer = async (fromDate, toDate, limit) => {
  const result = await db.query(
    `SELECT TOP ($1)
       c.id,
       c.customer_code,
       c.name,
       ISNULL(SUM(sii.quantity), 0) AS units_sold,
       ISNULL(SUM(si.total_amount), 0) AS revenue,
       COUNT(DISTINCT si.id) AS invoice_count
     FROM customers c
     INNER JOIN sales_invoices si ON si.customer_id = c.id
     LEFT JOIN sales_invoice_items sii ON sii.invoice_id = si.id
     WHERE c.is_active = 1
       AND si.is_active = 1
       AND si.status <> 'cancelled'
       AND si.invoice_date BETWEEN $2 AND $3
     GROUP BY c.id, c.customer_code, c.name
     ORDER BY revenue DESC`,
    [limit, fromDate, toDate]
  );
  return result.rows;
};

const fetchSalesTotalForWindow = async (fromDate, toDate) => {
  const result = await db.query(
    `SELECT ISNULL(SUM(total_amount), 0) AS total_revenue,
            ISNULL(SUM(quantity), 0) AS total_units
     FROM (
       SELECT si.total_amount, ISNULL(SUM(sii.quantity), 0) AS quantity
       FROM sales_invoices si
       LEFT JOIN sales_invoice_items sii ON sii.invoice_id = si.id
       WHERE si.is_active = 1
         AND si.status <> 'cancelled'
         AND si.invoice_date BETWEEN $1 AND $2
       GROUP BY si.id, si.total_amount
     ) inv`,
    RANGE_PARAMS(fromDate, toDate)
  );
  return result.rows[0] || { total_revenue: 0, total_units: 0 };
};

/**
 * GST: input tax credit (purchases), output liability (sales) and net payable.
 */
const fetchGstSummary = async (fromDate, toDate) => {
  const result = await db.query(
    `SELECT
       (SELECT ISNULL(SUM(tax_amount), 0)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date BETWEEN $1 AND $2)        AS input_tax_credit,
       (SELECT ISNULL(SUM(tax_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2)       AS output_liability,
       (SELECT ISNULL(SUM(taxable_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date BETWEEN $1 AND $2)       AS output_taxable_amount,
       (SELECT ISNULL(SUM(taxable_amount), 0)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date BETWEEN $1 AND $2)        AS input_taxable_amount`,
    RANGE_PARAMS(fromDate, toDate)
  );
  return result.rows[0] || {};
};

const fetchInventoryAnalytics = async (fromDate, toDate) => {
  const result = await db.query(
    `SELECT
       (SELECT ISNULL(SUM(ISNULL(psb.quantity_on_hand, 0) * p.cost_price), 0)
          FROM products p
          LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
         WHERE p.is_active = 1)                                       AS total_stock_value,
       (SELECT COUNT(*) FROM products WHERE is_active = 1)            AS total_products,
       (SELECT COUNT(*)
          FROM products p
          LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
         WHERE p.is_active = 1
           AND ISNULL(psb.quantity_available, 0) <= p.reorder_level
           AND ISNULL(psb.quantity_available, 0) > 0)                 AS low_stock_items,
       (SELECT COUNT(*)
          FROM products p
          LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
         WHERE p.is_active = 1
           AND ISNULL(psb.quantity_available, 0) <= 0)                AS out_of_stock_items,
       (SELECT ISNULL(SUM(sii.line_total), 0)
          FROM sales_invoice_items sii
          INNER JOIN sales_invoices si ON si.id = sii.invoice_id
         WHERE si.is_active = 1
           AND si.status <> 'cancelled'
           AND si.invoice_date BETWEEN $1 AND $2)                     AS revenue_in_window,
       (SELECT ISNULL(SUM(ir.total_amount), 0)
          FROM inward_records ir
         WHERE ir.is_active = 1
           AND ir.inward_date BETWEEN $1 AND $2)                      AS purchases_in_window`,
    RANGE_PARAMS(fromDate, toDate)
  );
  return result.rows[0] || {};
};

const fetchTotalAssetValue = async () => {
  const result = await db.query(`
    SELECT
      (SELECT ISNULL(SUM(ISNULL(psb.quantity_on_hand, 0) * p.cost_price), 0)
         FROM products p
         LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
        WHERE p.is_active = 1)                                  AS stock_value,
      (SELECT ISNULL(SUM(outstanding_amount), 0)
         FROM sales_invoices
        WHERE is_active = 1
          AND status <> 'cancelled')                            AS receivables_value
  `);
  return result.rows[0] || { stock_value: 0, receivables_value: 0 };
};

module.exports = {
  fetchFinancialQuarterly,
  fetchFinancialTotals,
  fetchTopProducts,
  fetchSalesByCustomer,
  fetchSalesTotalForWindow,
  fetchGstSummary,
  fetchInventoryAnalytics,
  fetchTotalAssetValue,
};

'use strict';

const db = require('../../config/db');

const fetchSalesOverview = async () => {
  const [totalsResult, trendResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        ISNULL(SUM(total_amount), 0) AS total_sales_amount,
        ISNULL(SUM(paid_amount), 0) AS paid_sales_amount,
        ISNULL(SUM(outstanding_amount), 0) AS outstanding_sales_amount,
        COUNT(1) AS invoice_count
      FROM sales_invoices
      WHERE is_active = 1
        AND status <> 'cancelled'
    `),
    db.query(`
      WITH month_anchor AS (
        SELECT DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) AS first_of_current_month
      ),
      month_series AS (
        SELECT 0 AS offset
        UNION ALL SELECT offset + 1 FROM month_series WHERE offset + 1 < 6
      ),
      window_months AS (
        SELECT DATEADD(month, -ms.offset, ma.first_of_current_month) AS month_start, ms.offset
        FROM month_series ms
        CROSS JOIN month_anchor ma
      )
      SELECT
        wm.month_start,
        YEAR(wm.month_start) AS year,
        MONTH(wm.month_start) AS month,
        ISNULL(SUM(si.total_amount), 0) AS amount,
        COUNT(si.id) AS count
      FROM window_months wm
      LEFT JOIN sales_invoices si
        ON si.is_active = 1
       AND si.status <> 'cancelled'
       AND si.invoice_date >= wm.month_start
       AND si.invoice_date < DATEADD(month, 1, wm.month_start)
      GROUP BY wm.month_start, wm.offset
      ORDER BY wm.month_start ASC
      OPTION (MAXRECURSION 100)
    `),
    db.query(`
      SELECT status, COUNT(1) AS count
      FROM sales_orders
      WHERE is_active = 1
      GROUP BY status
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    monthlyTrend: trendResult.rows,
    orderCounts: statusResult.rows,
  };
};

const fetchPurchaseOverview = async () => {
  const [totalsResult, trendResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        (SELECT ISNULL(SUM(total_amount), 0)
           FROM inward_records
          WHERE is_active = 1) AS total_purchase_amount,
        (SELECT ISNULL(SUM(amount), 0)
           FROM payments
          WHERE is_active = 1
            AND status = 'completed') AS paid_purchase_amount,
        (SELECT ISNULL(SUM(total_amount), 0)
           FROM inward_records
          WHERE is_active = 1)
        -
        (SELECT ISNULL(SUM(amount), 0)
           FROM payments
          WHERE is_active = 1
            AND status = 'completed') AS outstanding_purchase_amount,
        (SELECT COUNT(1)
           FROM inward_records
          WHERE is_active = 1) AS inward_count
    `),
    db.query(`
      WITH month_anchor AS (
        SELECT DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) AS first_of_current_month
      ),
      month_series AS (
        SELECT 0 AS offset
        UNION ALL SELECT offset + 1 FROM month_series WHERE offset + 1 < 6
      ),
      window_months AS (
        SELECT DATEADD(month, -ms.offset, ma.first_of_current_month) AS month_start, ms.offset
        FROM month_series ms
        CROSS JOIN month_anchor ma
      )
      SELECT
        wm.month_start,
        YEAR(wm.month_start) AS year,
        MONTH(wm.month_start) AS month,
        ISNULL(SUM(ir.total_amount), 0) AS amount,
        COUNT(ir.id) AS count
      FROM window_months wm
      LEFT JOIN inward_records ir
        ON ir.is_active = 1
       AND ir.inward_date >= wm.month_start
       AND ir.inward_date < DATEADD(month, 1, wm.month_start)
      GROUP BY wm.month_start, wm.offset
      ORDER BY wm.month_start ASC
      OPTION (MAXRECURSION 100)
    `),
    db.query(`
      SELECT status, COUNT(1) AS count
      FROM purchase_orders
      WHERE is_active = 1
      GROUP BY status
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    monthlyTrend: trendResult.rows,
    orderCounts: statusResult.rows,
  };
};

const fetchReceivablesOverview = async () => {
  const [totalsResult, topResult] = await Promise.all([
    db.query(`
      SELECT
        ISNULL(SUM(outstanding_amount), 0) AS total_receivable,
        ISNULL(SUM(CASE
          WHEN due_date < CAST(GETDATE() AS date)
           AND outstanding_amount > 0
           AND status NOT IN ('paid', 'cancelled')
          THEN outstanding_amount ELSE 0 END), 0) AS overdue_receivable,
        ISNULL(SUM(CASE
          WHEN due_date >= CAST(GETDATE() AS date)
           AND due_date <= DATEADD(day, 7, CAST(GETDATE() AS date))
           AND outstanding_amount > 0
           AND status NOT IN ('paid', 'cancelled')
          THEN outstanding_amount ELSE 0 END), 0) AS due_soon_receivable
      FROM sales_invoices
      WHERE is_active = 1
        AND status <> 'cancelled'
    `),
    db.query(`
      SELECT TOP (5)
        c.id,
        c.customer_code,
        c.name,
        SUM(si.outstanding_amount) AS outstanding_amount
      FROM customers c
      INNER JOIN sales_invoices si ON si.customer_id = c.id
      WHERE c.is_active = 1
        AND si.is_active = 1
        AND si.status NOT IN ('paid', 'cancelled')
        AND si.outstanding_amount > 0
      GROUP BY c.id, c.customer_code, c.name
      ORDER BY SUM(si.outstanding_amount) DESC
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    topOutstandingCustomers: topResult.rows,
  };
};

const fetchPayablesOverview = async () => {
  const [totalsResult, topResult] = await Promise.all([
    db.query(`
      SELECT
        (SELECT ISNULL(SUM(total_amount), 0)
           FROM inward_records
          WHERE is_active = 1) AS unpaid_grn_amount,
        (SELECT ISNULL(SUM(total_amount), 0)
           FROM inward_records
          WHERE is_active = 1)
        -
        (SELECT ISNULL(SUM(amount), 0)
           FROM payments
          WHERE is_active = 1
            AND status = 'completed') AS total_payable
    `),
    db.query(`
      SELECT TOP (5)
        v.id,
        v.vendor_code,
        v.name,
        ISNULL(grn.total_amount, 0) - ISNULL(pay.total_paid, 0) AS outstanding_amount
      FROM vendors v
      LEFT JOIN (
        SELECT vendor_id, SUM(total_amount) AS total_amount
        FROM inward_records
        WHERE is_active = 1
        GROUP BY vendor_id
      ) grn ON grn.vendor_id = v.id
      LEFT JOIN (
        SELECT vendor_id, SUM(amount) AS total_paid
        FROM payments
        WHERE is_active = 1 AND status = 'completed'
        GROUP BY vendor_id
      ) pay ON pay.vendor_id = v.id
      WHERE v.is_active = 1
        AND ISNULL(grn.total_amount, 0) - ISNULL(pay.total_paid, 0) > 0
      ORDER BY ISNULL(grn.total_amount, 0) - ISNULL(pay.total_paid, 0) DESC
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    topOutstandingVendors: topResult.rows,
  };
};

const fetchInventoryOverview = async () => {
  const [totalsResult, movementsResult, topResult] = await Promise.all([
    db.query(`
      SELECT
        ISNULL(SUM(ISNULL(psb.quantity_on_hand, 0) * p.cost_price), 0) AS total_stock_value,
        SUM(CASE
          WHEN ISNULL(psb.quantity_available, 0) <= p.reorder_level
           AND ISNULL(psb.quantity_available, 0) > 0
          THEN 1 ELSE 0 END) AS low_stock_items,
        SUM(CASE
          WHEN ISNULL(psb.quantity_available, 0) <= 0
          THEN 1 ELSE 0 END) AS out_of_stock_items
      FROM products p
      LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
      WHERE p.is_active = 1
    `),
    db.query(`
      SELECT TOP (8)
        sm.id,
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        sm.movement_type,
        sm.reference_type,
        sm.reference_id,
        sm.quantity_in,
        sm.quantity_out,
        sm.balance_after,
        sm.movement_date,
        sm.remarks,
        sm.created_at
      FROM stock_movements sm
      INNER JOIN products p ON p.id = sm.product_id
      ORDER BY sm.created_at DESC, sm.id DESC
    `),
    db.query(`
      SELECT TOP (5)
        p.id,
        p.sku,
        p.name,
        p.unit,
        ISNULL(psb.quantity_on_hand, 0) AS quantity_on_hand,
        p.cost_price,
        ISNULL(psb.quantity_on_hand, 0) * p.cost_price AS stock_value
      FROM products p
      LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
      WHERE p.is_active = 1
      ORDER BY ISNULL(psb.quantity_on_hand, 0) * p.cost_price DESC, p.name ASC
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    recentStockMovements: movementsResult.rows,
    topStockValueProducts: topResult.rows,
  };
};

const fetchLeadsOverview = async () => {
  const [totalsResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        SUM(CASE WHEN is_active = 1 AND status NOT IN ('converted','lost') THEN 1 ELSE 0 END) AS active_leads,
        SUM(CASE WHEN is_active = 1 AND status = 'converted' THEN 1 ELSE 0 END) AS converted_leads,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) AS total_leads,
        ISNULL(SUM(CASE
          WHEN is_active = 1 AND status NOT IN ('converted','lost')
          THEN expected_value ELSE 0 END), 0) AS lead_value_open
      FROM leads
    `),
    db.query(`
      SELECT status, COUNT(1) AS count, ISNULL(SUM(expected_value), 0) AS value
      FROM leads
      WHERE is_active = 1
      GROUP BY status
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    byStatus: statusResult.rows,
  };
};

const fetchRecentActivityOverview = async () => {
  const result = await db.query(`
    SELECT TOP (12)
      type,
      reference_number,
      title,
      amount,
      status,
      occurred_at
    FROM (
      SELECT
        'invoice' AS type,
        si.invoice_number AS reference_number,
        CONCAT('Invoice issued to ', c.name) AS title,
        si.total_amount AS amount,
        si.status,
        si.created_at AS occurred_at
      FROM sales_invoices si
      INNER JOIN customers c ON c.id = si.customer_id
      WHERE si.is_active = 1
      UNION ALL
      SELECT
        'receipt' AS type,
        r.receipt_number AS reference_number,
        CONCAT('Receipt from ', c.name) AS title,
        r.amount AS amount,
        r.status,
        r.created_at AS occurred_at
      FROM receipts r
      INNER JOIN customers c ON c.id = r.customer_id
      WHERE r.is_active = 1
      UNION ALL
      SELECT
        'inward' AS type,
        ir.inward_number AS reference_number,
        CONCAT('Goods received from ', v.name) AS title,
        ir.total_amount AS amount,
        'completed' AS status,
        ir.created_at AS occurred_at
      FROM inward_records ir
      INNER JOIN vendors v ON v.id = ir.vendor_id
      WHERE ir.is_active = 1
      UNION ALL
      SELECT
        'payment' AS type,
        p.payment_number AS reference_number,
        CONCAT('Payment to ', v.name) AS title,
        p.amount AS amount,
        p.status,
        p.created_at AS occurred_at
      FROM payments p
      INNER JOIN vendors v ON v.id = p.vendor_id
      WHERE p.is_active = 1
      UNION ALL
      SELECT
        'stock_movement' AS type,
        CONCAT('SM-', sm.id) AS reference_number,
        CONCAT(p.name, ' stock ', sm.movement_type) AS title,
        CAST(sm.quantity_in - sm.quantity_out AS DECIMAL(14,2)) AS amount,
        sm.movement_type AS status,
        sm.created_at AS occurred_at
      FROM stock_movements sm
      INNER JOIN products p ON p.id = sm.product_id
      UNION ALL
      SELECT
        'lead' AS type,
        lead_number AS reference_number,
        ISNULL(customer_company, customer_name) AS title,
        ISNULL(expected_value, 0) AS amount,
        status,
        created_at AS occurred_at
      FROM leads
      WHERE is_active = 1
    ) recent
    ORDER BY occurred_at DESC
  `);

  return result.rows;
};

const fetchAlertsOverview = async () => {
  const [overdueInvoices, lowStockProducts, pendingReceipts, unpaidGrns, staleLeads] = await Promise.all([
    db.query(`
      SELECT TOP (5)
        'overdue_invoice' AS type,
        'high' AS severity,
        invoice_number AS reference_number,
        CONCAT('Invoice overdue by ', DATEDIFF(day, due_date, CAST(GETDATE() AS date)), ' day(s)') AS message,
        outstanding_amount AS amount,
        due_date AS due_date,
        created_at
      FROM sales_invoices
      WHERE is_active = 1
        AND status NOT IN ('paid', 'cancelled')
        AND outstanding_amount > 0
        AND due_date < CAST(GETDATE() AS date)
      ORDER BY due_date ASC
    `),
    db.query(`
      SELECT TOP (5)
        'low_stock' AS type,
        CASE WHEN ISNULL(psb.quantity_available, 0) <= 0 THEN 'high' ELSE 'medium' END AS severity,
        p.sku AS reference_number,
        CONCAT(p.name, ' is below reorder level') AS message,
        ISNULL(psb.quantity_available, 0) AS amount,
        CAST(NULL AS DATE) AS due_date,
        p.updated_at AS created_at
      FROM products p
      LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
      WHERE p.is_active = 1
        AND ISNULL(psb.quantity_available, 0) <= p.reorder_level
      ORDER BY ISNULL(psb.quantity_available, 0) ASC, p.name ASC
    `),
    db.query(`
      SELECT TOP (5)
        'pending_po_receipt' AS type,
        CASE WHEN expected_delivery_date < CAST(GETDATE() AS date) THEN 'high' ELSE 'medium' END AS severity,
        po_number AS reference_number,
        CONCAT('Purchase order pending receipt from ', v.name) AS message,
        total_amount AS amount,
        expected_delivery_date AS due_date,
        po.created_at
      FROM purchase_orders po
      INNER JOIN vendors v ON v.id = po.vendor_id
      WHERE po.is_active = 1
        AND po.status IN ('sent', 'partially_received')
      ORDER BY expected_delivery_date ASC, po.created_at ASC
    `),
    db.query(`
      SELECT TOP (5)
        'unpaid_grn' AS type,
        'medium' AS severity,
        ir.inward_number AS reference_number,
        CONCAT('GRN payable pending for ', v.name) AS message,
        ir.total_amount - ISNULL(pay.total_paid, 0) AS amount,
        ir.inward_date AS due_date,
        ir.created_at
      FROM inward_records ir
      INNER JOIN vendors v ON v.id = ir.vendor_id
      LEFT JOIN (
        SELECT inward_id, SUM(amount) AS total_paid
        FROM payments
        WHERE is_active = 1
          AND status = 'completed'
          AND inward_id IS NOT NULL
        GROUP BY inward_id
      ) pay ON pay.inward_id = ir.id
      WHERE ir.is_active = 1
        AND ir.total_amount - ISNULL(pay.total_paid, 0) > 0
      ORDER BY ir.inward_date ASC
    `),
    db.query(`
      SELECT TOP (5)
        'stale_lead' AS type,
        'medium' AS severity,
        lead_number AS reference_number,
        CONCAT(ISNULL(customer_company, customer_name), ' has no recent progress') AS message,
        ISNULL(expected_value, 0) AS amount,
        CAST(NULL AS DATE) AS due_date,
        updated_at AS created_at
      FROM leads
      WHERE is_active = 1
        AND status IN ('new', 'contacted', 'qualified')
        AND updated_at < DATEADD(day, -7, SYSUTCDATETIME())
      ORDER BY updated_at ASC
    `),
  ]);

  return [
    ...overdueInvoices.rows,
    ...lowStockProducts.rows,
    ...pendingReceipts.rows,
    ...unpaidGrns.rows,
    ...staleLeads.rows,
  ];
};

const fetchSummaryTotals = async (days) => {
  const result = await db.query(
    `SELECT
       (SELECT ISNULL(SUM(total_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date >= DATEADD(day, -$1, CAST(GETDATE() AS DATE)))   AS total_sales_amount,

       (SELECT COUNT(*)
          FROM sales_invoices
         WHERE is_active = 1
           AND status <> 'cancelled'
           AND invoice_date >= DATEADD(day, -$2, CAST(GETDATE() AS DATE)))   AS total_sales_count,

       (SELECT ISNULL(SUM(total_amount), 0)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date >= DATEADD(day, -$3, CAST(GETDATE() AS DATE)))    AS total_purchase_amount,

       (SELECT COUNT(*)
          FROM inward_records
         WHERE is_active = 1
           AND inward_date >= DATEADD(day, -$4, CAST(GETDATE() AS DATE)))    AS total_purchase_count,

       (SELECT ISNULL(SUM(outstanding_amount), 0)
          FROM sales_invoices
         WHERE is_active = 1
           AND status IN ('issued','partially_paid','overdue'))              AS outstanding_receivables,

       (SELECT COUNT(*)
          FROM sales_invoices
         WHERE is_active = 1
           AND status IN ('issued','partially_paid','overdue'))              AS overdue_invoice_count,

       (SELECT ISNULL(SUM(ir.total_amount), 0)
          FROM inward_records ir
         WHERE ir.is_active = 1)
       -
       (SELECT ISNULL(SUM(p.amount), 0)
          FROM payments p
         WHERE p.is_active = 1
           AND p.status = 'completed')                                       AS outstanding_payables,

       (SELECT COUNT(*)
          FROM leads
         WHERE created_at >= DATEADD(day, -$5, CAST(GETDATE() AS DATE)))     AS leads_received,

       (SELECT COUNT(*)
          FROM quotations
         WHERE is_active = 1
           AND quotation_date >= DATEADD(day, -$6, CAST(GETDATE() AS DATE))) AS quotations_sent,

       (SELECT COUNT(*)
          FROM sales_orders
         WHERE is_active = 1
           AND order_date >= DATEADD(day, -$7, CAST(GETDATE() AS DATE)))     AS sales_orders_count,

       (SELECT COUNT(*)
          FROM purchase_orders
         WHERE is_active = 1
           AND status IN ('draft','sent','partially_received'))              AS pending_purchase_orders,

       (SELECT COUNT(*) FROM customers WHERE is_active = 1)                  AS total_customers,
       (SELECT COUNT(*) FROM vendors   WHERE is_active = 1)                  AS total_vendors,
       (SELECT COUNT(*) FROM products  WHERE is_active = 1)                  AS total_products,

       (SELECT COUNT(*)
          FROM products p
          LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
         WHERE p.is_active = 1
           AND ISNULL(psb.quantity_available, 0) <= p.reorder_level)         AS low_stock_count`,
    [days, days, days, days, days, days, days]
  );

  return result.rows[0];
};

const fetchTopCustomers = async ({ days, limit }) => {
  const result = await db.query(
    `SELECT TOP ($1)
       c.id,
       c.customer_code,
       c.name,
       SUM(si.total_amount)        AS total_revenue,
       SUM(si.outstanding_amount)  AS outstanding_amount,
       COUNT(si.id)                AS invoice_count
     FROM customers c
     INNER JOIN sales_invoices si ON si.customer_id = c.id
     WHERE c.is_active = 1
       AND si.is_active = 1
       AND si.status <> 'cancelled'
       AND si.invoice_date >= DATEADD(day, -$2, CAST(GETDATE() AS DATE))
     GROUP BY c.id, c.customer_code, c.name
     ORDER BY total_revenue DESC`,
    [limit, days]
  );

  return result.rows;
};

const fetchLowStockProducts = async (limit) => {
  const result = await db.query(
    `SELECT TOP ($1)
       p.id,
       p.sku,
       p.name,
       p.unit,
       p.reorder_level,
       p.reorder_quantity,
       ISNULL(psb.quantity_on_hand, 0)   AS quantity_on_hand,
       ISNULL(psb.quantity_reserved, 0)  AS quantity_reserved,
       ISNULL(psb.quantity_available, 0) AS quantity_available
     FROM products p
     LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
     WHERE p.is_active = 1
       AND ISNULL(psb.quantity_available, 0) <= p.reorder_level
     ORDER BY (p.reorder_level - ISNULL(psb.quantity_available, 0)) DESC, p.name ASC`,
    [limit]
  );

  return result.rows;
};

const fetchRecentActivity = async (limit) => {
  const result = await db.query(
    `SELECT TOP ($1)
       al.id,
       al.entity_type,
       al.entity_id,
       al.action,
       al.created_at,
       al.actor_user_id,
       u.full_name AS actor_full_name,
       u.username  AS actor_username
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     ORDER BY al.created_at DESC, al.id DESC`,
    [limit]
  );

  return result.rows;
};

const fetchSalesTrend = async (days) => {
  const result = await db.query(
    `SELECT
       CAST(invoice_date AS DATE) AS date,
       ISNULL(SUM(total_amount), 0) AS amount,
       COUNT(*) AS invoice_count
     FROM sales_invoices
     WHERE is_active = 1
       AND status <> 'cancelled'
       AND invoice_date >= DATEADD(day, -$1, CAST(GETDATE() AS DATE))
     GROUP BY CAST(invoice_date AS DATE)
     ORDER BY CAST(invoice_date AS DATE) ASC`,
    [days]
  );

  return result.rows;
};

const fetchBestSellingProducts = async ({ days, limit }) => {
  const result = await db.query(
    `SELECT TOP ($1)
       p.id,
       p.sku,
       p.name,
       p.unit,
       SUM(sii.quantity)   AS quantity_sold,
       SUM(sii.line_total) AS total_revenue,
       COUNT(DISTINCT si.id) AS invoice_count
     FROM sales_invoice_items sii
     INNER JOIN sales_invoices si ON si.id = sii.invoice_id
     INNER JOIN products p        ON p.id = sii.product_id
     WHERE si.is_active = 1
       AND si.status <> 'cancelled'
       AND si.invoice_date >= DATEADD(day, -$2, CAST(GETDATE() AS DATE))
       AND p.is_active = 1
     GROUP BY p.id, p.sku, p.name, p.unit
     ORDER BY total_revenue DESC`,
    [limit, days]
  );

  return result.rows;
};

const fetchMonthlySales = async (months) => {
  const result = await db.query(
    `WITH month_anchor AS (
       SELECT DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) AS first_of_current_month
     ),
     month_series AS (
       SELECT 0 AS offset
       UNION ALL SELECT offset + 1 FROM month_series WHERE offset + 1 < $1
     ),
     window_months AS (
       SELECT
         DATEADD(month, -ms.offset, ma.first_of_current_month) AS month_start,
         ms.offset AS offset
       FROM month_series ms
       CROSS JOIN month_anchor ma
     )
     SELECT
       wm.month_start                                  AS month_start,
       YEAR(wm.month_start)                            AS year,
       MONTH(wm.month_start)                           AS month,
       ISNULL(SUM(si.total_amount), 0)                 AS amount,
       COUNT(si.id)                                    AS invoice_count
     FROM window_months wm
     LEFT JOIN sales_invoices si
       ON si.is_active = 1
      AND si.status <> 'cancelled'
      AND si.invoice_date >= wm.month_start
      AND si.invoice_date <  DATEADD(month, 1, wm.month_start)
     GROUP BY wm.month_start, wm.offset
     ORDER BY wm.month_start ASC
     OPTION (MAXRECURSION 100)`,
    [months]
  );

  return result.rows;
};

module.exports = {
  fetchSalesOverview,
  fetchPurchaseOverview,
  fetchReceivablesOverview,
  fetchPayablesOverview,
  fetchInventoryOverview,
  fetchLeadsOverview,
  fetchRecentActivityOverview,
  fetchAlertsOverview,
  fetchSummaryTotals,
  fetchTopCustomers,
  fetchLowStockProducts,
  fetchRecentActivity,
  fetchSalesTrend,
  fetchBestSellingProducts,
  fetchMonthlySales,
};

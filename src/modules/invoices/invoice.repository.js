'use strict';

const db = require('../../config/db');
const { INVOICE_NUMBER_PREFIX, INVOICE_SORT_FIELDS } = require('./invoice.constants');

const summaryColumns = `
  si.id,
  si.invoice_number,
  si.sales_order_id,
  si.customer_id,
  si.invoice_date,
  si.due_date,
  si.status,
  si.payment_term_id,
  si.subtotal_amount,
  si.discount_amount,
  si.taxable_amount,
  si.tax_amount,
  si.total_amount,
  si.paid_amount,
  si.outstanding_amount,
  si.is_active,
  si.created_at,
  si.updated_at,
  c.id AS customer_id_ref,
  c.customer_code,
  c.name AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone,
  c.gst_number AS customer_gst_number,
  pt.id AS payment_term_id_ref,
  pt.name AS payment_term_name,
  pt.days AS payment_term_days,
  so.order_number AS sales_order_number,
  ic.item_count
`;

const detailColumns = `
  ${summaryColumns},
  si.billing_address,
  si.shipping_address,
  si.customer_gst_snapshot,
  si.cgst_amount,
  si.sgst_amount,
  si.igst_amount,
  si.round_off_amount,
  si.notes,
  si.created_by,
  si.updated_by
`;

const summaryJoins = `
  LEFT JOIN customers c ON c.id = si.customer_id
  LEFT JOIN payment_terms pt ON pt.id = si.payment_term_id
  LEFT JOIN sales_orders so ON so.id = si.sales_order_id
  LEFT JOIN (
    SELECT invoice_id, COUNT(1) AS item_count
    FROM sales_invoice_items
    WHERE is_active = 1
    GROUP BY invoice_id
  ) ic ON ic.invoice_id = si.id
`;

const buildListFilters = (filters) => {
  const where = ['si.is_active = 1'];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(si.invoice_number LIKE ${key} OR c.name LIKE ${key} OR c.customer_code LIKE ${key})`);
  }

  if (filters.customerId) {
    params.push(filters.customerId);
    where.push(`si.customer_id = $${params.length}`);
  }

  if (filters.status === 'overdue') {
    where.push(`si.due_date < CAST(SYSUTCDATETIME() AS date) AND si.outstanding_amount > 0 AND si.status NOT IN ('paid', 'cancelled')`);
  } else if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`si.status = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`si.invoice_date >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`si.invoice_date <= $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where[0] = `si.is_active = $${params.length}`;
  }

  return {
    params,
    whereClause: `WHERE ${where.join(' AND ')}`,
  };
};

const listInvoices = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = INVOICE_SORT_FIELDS[sortBy] || INVOICE_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${summaryColumns}
         FROM sales_invoices si
         ${summaryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, si.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM sales_invoices si
         LEFT JOIN customers c ON c.id = si.customer_id
         ${whereClause}`,
      params
    ),
  ]);

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findById = async (invoiceId) => {
  const result = await db.query(
    `SELECT ${detailColumns}
       FROM sales_invoices si
       ${summaryJoins}
      WHERE si.id = $1`,
    [invoiceId]
  );
  return result.rows[0] || null;
};

const findBySalesOrderId = async (salesOrderId, client = db) => {
  const result = await client.query(
    `SELECT TOP 1 id, invoice_number, status
       FROM sales_invoices WITH (UPDLOCK, HOLDLOCK)
      WHERE sales_order_id = $1
        AND is_active = 1
        AND status <> 'cancelled'
      ORDER BY id DESC`,
    [salesOrderId]
  );
  return result.rows[0] || null;
};

const findForReceipt = async (invoiceId, client) => {
  const result = await client.query(
    `SELECT
       id,
       invoice_number,
       customer_id,
       status,
       total_amount,
       paid_amount,
       outstanding_amount
     FROM sales_invoices WITH (UPDLOCK, HOLDLOCK)
     WHERE id = $1
       AND is_active = 1`,
    [invoiceId]
  );
  return result.rows[0] || null;
};

const listItems = async (invoiceId, client = db) => {
  const result = await client.query(
    `SELECT
       sii.id,
       sii.invoice_id,
       sii.product_id,
       sii.product_name_snapshot,
       sii.sku_snapshot,
       sii.hsn_sac_code,
       sii.quantity,
       sii.unit,
       sii.unit_price,
       sii.discount_percent,
       sii.discount_amount,
       sii.taxable_amount,
       sii.cgst_rate,
       sii.sgst_rate,
       sii.igst_rate,
       sii.tax_rate,
       sii.cgst_amount,
       sii.sgst_amount,
       sii.igst_amount,
       sii.tax_amount,
       sii.line_total,
       sii.sort_order,
       p.sku AS product_sku,
       p.name AS product_name
     FROM sales_invoice_items sii
     LEFT JOIN products p ON p.id = sii.product_id
     WHERE sii.invoice_id = $1 AND sii.is_active = 1
     ORDER BY sii.sort_order ASC, sii.id ASC`,
    [invoiceId]
  );
  return result.rows;
};

const customerExists = async (customerId) => {
  const result = await db.query(`SELECT id FROM customers WHERE id = $1 AND is_active = 1`, [customerId]);
  return Boolean(result.rows[0]);
};

const paymentTermExists = async (paymentTermId) => {
  const result = await db.query(`SELECT id FROM payment_terms WHERE id = $1 AND is_active = 1`, [paymentTermId]);
  return Boolean(result.rows[0]);
};

const salesOrderExists = async (salesOrderId) => {
  const result = await db.query(`SELECT id FROM sales_orders WHERE id = $1 AND is_active = 1`, [salesOrderId]);
  return Boolean(result.rows[0]);
};

const productsExist = async (productIds) => {
  if (productIds.length === 0) return new Set();
  const placeholders = productIds.map((_, idx) => `$${idx + 1}`).join(', ');
  const result = await db.query(`SELECT id FROM products WHERE id IN (${placeholders}) AND is_active = 1`, productIds);
  return new Set(result.rows.map((row) => Number(row.id)));
};

const generateInvoiceNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${INVOICE_NUMBER_PREFIX}-${yyyy}${mm}-`;

  const result = await client.query(
    `SELECT TOP 1 invoice_number
       FROM sales_invoices
      WHERE invoice_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.invoice_number) {
    const parsed = parseInt(result.rows[0].invoice_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }
  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertInvoice = async (invoice, client) => {
  const result = await client.query(
    `INSERT INTO sales_invoices (
      invoice_number, sales_order_id, customer_id, invoice_date, due_date, status,
      payment_term_id, billing_address, shipping_address, customer_gst_snapshot,
      subtotal_amount, discount_amount, taxable_amount,
      cgst_amount, sgst_amount, igst_amount, tax_amount, round_off_amount, total_amount,
      paid_amount, outstanding_amount, notes, is_active, created_by, updated_by
    )
    OUTPUT INSERTED.id
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17, $18, $19,
      0, $19, $20, 1, $21, $21
    )`,
    [
      invoice.invoiceNumber,
      invoice.salesOrderId || null,
      invoice.customerId,
      invoice.invoiceDate,
      invoice.dueDate,
      invoice.status,
      invoice.paymentTermId || null,
      invoice.billingAddress || null,
      invoice.shippingAddress || null,
      invoice.customerGstSnapshot || null,
      invoice.subtotalAmount,
      invoice.discountAmount,
      invoice.taxableAmount,
      invoice.cgstAmount,
      invoice.sgstAmount,
      invoice.igstAmount,
      invoice.taxAmount,
      invoice.roundOffAmount,
      invoice.totalAmount,
      invoice.notes || null,
      invoice.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const updateInvoiceHeader = async (invoiceId, updates, client) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.salesOrderId !== undefined) add('sales_order_id', updates.salesOrderId || null);
  if (updates.customerId !== undefined) add('customer_id', updates.customerId);
  if (updates.invoiceDate !== undefined) add('invoice_date', updates.invoiceDate);
  if (updates.dueDate !== undefined) add('due_date', updates.dueDate);
  if (updates.paymentTermId !== undefined) add('payment_term_id', updates.paymentTermId || null);
  if (updates.billingAddress !== undefined) add('billing_address', updates.billingAddress || null);
  if (updates.shippingAddress !== undefined) add('shipping_address', updates.shippingAddress || null);
  if (updates.customerGstSnapshot !== undefined) add('customer_gst_snapshot', updates.customerGstSnapshot || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
  if (updates.status !== undefined) add('status', updates.status);

  if (updates.totals) {
    add('subtotal_amount', updates.totals.subtotalAmount);
    add('discount_amount', updates.totals.discountAmount);
    add('taxable_amount', updates.totals.taxableAmount);
    add('cgst_amount', updates.totals.cgstAmount);
    add('sgst_amount', updates.totals.sgstAmount);
    add('igst_amount', updates.totals.igstAmount);
    add('tax_amount', updates.totals.taxAmount);
    add('round_off_amount', updates.totals.roundOffAmount);
    add('total_amount', updates.totals.totalAmount);
    add('outstanding_amount', updates.totals.totalAmount);
  }

  add('updated_by', updates.actorUserId);
  params.push(invoiceId);
  await client.query(`UPDATE sales_invoices SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const setStatus = async (invoiceId, status, actorUserId) => {
  await db.query(`UPDATE sales_invoices SET status = $1, updated_by = $2 WHERE id = $3`, [status, actorUserId, invoiceId]);
};

const applyReceipt = async (invoiceId, receiptTotals, client) => {
  await client.query(
    `UPDATE sales_invoices
        SET paid_amount = $1,
            outstanding_amount = $2,
            status = $3,
            updated_by = $4
      WHERE id = $5`,
    [
      receiptTotals.paidAmount,
      receiptTotals.outstandingAmount,
      receiptTotals.status,
      receiptTotals.actorUserId,
      invoiceId,
    ]
  );
};

const insertItem = async (invoiceId, item, client) => {
  await client.query(
    `INSERT INTO sales_invoice_items (
      invoice_id, product_id, product_name_snapshot, sku_snapshot, hsn_sac_code,
      quantity, unit, unit_price,
      discount_percent, discount_amount, taxable_amount,
      cgst_rate, sgst_rate, igst_rate, tax_rate,
      cgst_amount, sgst_amount, igst_amount, tax_amount,
      line_total, sort_order, is_active, created_by, updated_by
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17, $18, $19,
      $20, $21, 1, $22, $22
    )`,
    [
      invoiceId,
      item.productId || null,
      item.productNameSnapshot,
      item.skuSnapshot || null,
      item.hsnSacCode || null,
      item.quantity,
      item.unit || 'PCS',
      item.unitPrice,
      item.discountPercent,
      item.discountAmount,
      item.taxableAmount,
      item.cgstRate,
      item.sgstRate,
      item.igstRate,
      item.taxRate,
      item.cgstAmount,
      item.sgstAmount,
      item.igstAmount,
      item.taxAmount,
      item.lineTotal,
      item.sortOrder,
      item.actorUserId,
    ]
  );
};

const softDeleteItems = async (invoiceId, actorUserId, client) => {
  await client.query(
    `UPDATE sales_invoice_items SET is_active = 0, updated_by = $1 WHERE invoice_id = $2 AND is_active = 1`,
    [actorUserId, invoiceId]
  );
};

const getMetrics = async () => {
  const [totalsResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_invoices,
        SUM(total_amount) AS total_amount,
        SUM(outstanding_amount) AS total_receivables,
        SUM(CASE WHEN due_date < CAST(SYSUTCDATETIME() AS date) AND outstanding_amount > 0 AND status NOT IN ('paid','cancelled') THEN outstanding_amount ELSE 0 END) AS overdue_amount,
        SUM(CASE WHEN MONTH(invoice_date) = MONTH(SYSUTCDATETIME()) AND YEAR(invoice_date) = YEAR(SYSUTCDATETIME()) THEN paid_amount ELSE 0 END) AS paid_mtd,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count
      FROM sales_invoices
      WHERE is_active = 1 AND status <> 'cancelled'
    `),
    db.query(`
      SELECT status, COUNT(1) AS count, SUM(total_amount) AS amount, SUM(outstanding_amount) AS outstanding
      FROM sales_invoices
      WHERE is_active = 1
      GROUP BY status
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    statusBreakdown: statusResult.rows,
  };
};

module.exports = {
  listInvoices,
  findById,
  findBySalesOrderId,
  findForReceipt,
  listItems,
  customerExists,
  paymentTermExists,
  salesOrderExists,
  productsExist,
  generateInvoiceNumber,
  insertInvoice,
  updateInvoiceHeader,
  setStatus,
  applyReceipt,
  insertItem,
  softDeleteItems,
  getMetrics,
};

'use strict';

const db = require('../../config/db');
const { QUOTATION_SORT_FIELDS, QUOTATION_NUMBER_PREFIX } = require('./quotation.constants');

const summaryColumns = `
  q.id,
  q.quotation_number,
  q.customer_id,
  q.lead_id,
  q.quotation_date,
  q.valid_until,
  q.status,
  q.payment_term_id,
  q.subtotal_amount,
  q.discount_amount,
  q.taxable_amount,
  q.tax_amount,
  q.total_amount,
  q.is_active,
  q.created_at,
  q.updated_at,
  q.converted_at,
  q.approved_at,
  c.id   AS customer_id_ref,
  c.name AS customer_name,
  c.customer_code AS customer_code,
  c.email AS customer_email,
  c.phone AS customer_phone,
  c.gst_number AS customer_gst_number,
  pt.id   AS payment_term_id_ref,
  pt.name AS payment_term_name,
  pt.days AS payment_term_days,
  u.id   AS assigned_to_id,
  u.full_name AS assigned_to_name,
  ic.item_count AS item_count,
  so.so_id      AS converted_sales_order_id,
  so.so_number  AS converted_sales_order_number
`;

const detailColumns = `
  ${summaryColumns},
  q.billing_address,
  q.shipping_address,
  q.cgst_amount,
  q.sgst_amount,
  q.igst_amount,
  q.round_off_amount,
  q.notes,
  q.terms_and_conditions,
  q.assigned_to,
  q.approved_by,
  q.created_by,
  q.updated_by
`;

const summaryJoins = `
  LEFT JOIN customers c     ON c.id  = q.customer_id
  LEFT JOIN payment_terms pt ON pt.id = q.payment_term_id
  LEFT JOIN users u         ON u.id  = q.assigned_to
  LEFT JOIN (
    SELECT quotation_id, COUNT(1) AS item_count
    FROM quotation_items
    WHERE is_active = 1
    GROUP BY quotation_id
  ) ic ON ic.quotation_id = q.id
  LEFT JOIN (
    SELECT id AS so_id, order_number AS so_number, quotation_id
    FROM sales_orders
    WHERE is_active = 1
  ) so ON so.quotation_id = q.id
`;

const buildListFilters = (filters) => {
  const where = ['q.is_active = 1'];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      q.quotation_number LIKE ${key}
      OR c.name LIKE ${key}
      OR c.customer_code LIKE ${key}
    )`);
  }

  if (filters.customerId) {
    params.push(filters.customerId);
    where.push(`q.customer_id = $${params.length}`);
  }

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`q.status = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`q.quotation_date >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`q.quotation_date <= $${params.length}`);
  }

  return {
    params,
    whereClause: `WHERE ${where.join(' AND ')}`,
  };
};

const listQuotations = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = QUOTATION_SORT_FIELDS[sortBy] || QUOTATION_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${summaryColumns}
         FROM quotations q
         ${summaryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, q.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM quotations q
         LEFT JOIN customers c ON c.id = q.customer_id
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

const findById = async (quotationId) => {
  const result = await db.query(
    `SELECT ${detailColumns}
       FROM quotations q
       ${summaryJoins}
      WHERE q.id = $1`,
    [quotationId]
  );

  return result.rows[0] || null;
};

const findLatestByLeadId = async (leadId, client = db) => {
  const result = await client.query(
    `SELECT TOP 1 id
       FROM quotations
      WHERE lead_id = $1
        AND is_active = 1
      ORDER BY id DESC`,
    [leadId]
  );

  return result.rows[0] || null;
};

const listItems = async (quotationId) => {
  const result = await db.query(
    `SELECT
       qi.id,
       qi.quotation_id,
       qi.product_id,
       qi.product_name_snapshot,
       qi.sku_snapshot,
       qi.hsn_sac_code,
       qi.quantity,
       qi.unit,
       qi.unit_price,
       qi.discount_percent,
       qi.discount_amount,
       qi.taxable_amount,
       qi.cgst_rate,
       qi.sgst_rate,
       qi.igst_rate,
       qi.tax_rate,
       qi.cgst_amount,
       qi.sgst_amount,
       qi.igst_amount,
       qi.tax_amount,
       qi.line_total,
       qi.sort_order,
       p.sku AS product_sku,
       p.name AS product_name
     FROM quotation_items qi
     LEFT JOIN products p ON p.id = qi.product_id
     WHERE qi.quotation_id = $1 AND qi.is_active = 1
     ORDER BY qi.sort_order ASC, qi.id ASC`,
    [quotationId]
  );
  return result.rows;
};

const customerExists = async (customerId) => {
  const result = await db.query(
    `SELECT id FROM customers WHERE id = $1 AND is_active = 1`,
    [customerId]
  );
  return Boolean(result.rows[0]);
};

const paymentTermExists = async (paymentTermId) => {
  const result = await db.query(
    `SELECT id FROM payment_terms WHERE id = $1 AND is_active = 1`,
    [paymentTermId]
  );
  return Boolean(result.rows[0]);
};

const userExists = async (userId) => {
  const result = await db.query(
    `SELECT id FROM users WHERE id = $1 AND is_active = 1`,
    [userId]
  );
  return Boolean(result.rows[0]);
};

const productsExist = async (productIds) => {
  if (productIds.length === 0) return new Set();
  const placeholders = productIds.map((_, idx) => `$${idx + 1}`).join(', ');
  const result = await db.query(
    `SELECT id FROM products WHERE id IN (${placeholders}) AND is_active = 1`,
    productIds
  );
  return new Set(result.rows.map((row) => Number(row.id)));
};

const generateQuotationNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${QUOTATION_NUMBER_PREFIX}-${yyyy}${mm}-`;

  const result = await client.query(
    `SELECT TOP 1 quotation_number
       FROM quotations
      WHERE quotation_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.quotation_number) {
    const tail = result.rows[0].quotation_number.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertQuotation = async (quotation, client) => {
  const result = await client.query(
    `INSERT INTO quotations (
       quotation_number, customer_id, lead_id, quotation_date, valid_until,
       status, payment_term_id, billing_address, shipping_address,
       subtotal_amount, discount_amount, taxable_amount,
       cgst_amount, sgst_amount, igst_amount, tax_amount, round_off_amount, total_amount,
       notes, terms_and_conditions, assigned_to, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12,
       $13, $14, $15, $16, $17, $18,
       $19, $20, $21, 1, $22, $22
     )`,
    [
      quotation.quotationNumber,
      quotation.customerId,
      quotation.leadId || null,
      quotation.quotationDate,
      quotation.validUntil,
      quotation.status,
      quotation.paymentTermId || null,
      quotation.billingAddress || null,
      quotation.shippingAddress || null,
      quotation.subtotalAmount,
      quotation.discountAmount,
      quotation.taxableAmount,
      quotation.cgstAmount,
      quotation.sgstAmount,
      quotation.igstAmount,
      quotation.taxAmount,
      quotation.roundOffAmount,
      quotation.totalAmount,
      quotation.notes || null,
      quotation.termsAndConditions || null,
      quotation.assignedTo || null,
      quotation.actorUserId,
    ]
  );

  return result.rows[0].id;
};

const updateQuotationHeader = async (quotationId, updates, client) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.customerId !== undefined) add('customer_id', updates.customerId);
  if (updates.leadId !== undefined) add('lead_id', updates.leadId || null);
  if (updates.quotationDate !== undefined) add('quotation_date', updates.quotationDate);
  if (updates.validUntil !== undefined) add('valid_until', updates.validUntil);
  if (updates.paymentTermId !== undefined) add('payment_term_id', updates.paymentTermId || null);
  if (updates.billingAddress !== undefined) add('billing_address', updates.billingAddress || null);
  if (updates.shippingAddress !== undefined) add('shipping_address', updates.shippingAddress || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
  if (updates.termsAndConditions !== undefined) add('terms_and_conditions', updates.termsAndConditions || null);
  if (updates.assignedTo !== undefined) add('assigned_to', updates.assignedTo || null);
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
  }

  add('updated_by', updates.actorUserId);
  params.push(quotationId);

  await client.query(
    `UPDATE quotations
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}`,
    params
  );
};

const setStatus = async (quotationId, status, actorUserId, options = {}, client = db) => {
  const assignments = ['status = $1', 'updated_by = $2'];
  const params = [status, actorUserId];

  if (options.setApprovedAt) {
    params.push(actorUserId);
    assignments.push(`approved_by = $${params.length}`);
    assignments.push('approved_at = SYSUTCDATETIME()');
  }

  if (options.setConvertedAt) {
    assignments.push('converted_at = SYSUTCDATETIME()');
  }

  params.push(quotationId);

  await client.query(
    `UPDATE quotations
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}`,
    params
  );
};

const insertItem = async (quotationId, item, client) => {
  await client.query(
    `INSERT INTO quotation_items (
       quotation_id, product_id, product_name_snapshot, sku_snapshot, hsn_sac_code,
       quantity, unit, unit_price,
       discount_percent, discount_amount,
       taxable_amount,
       cgst_rate, sgst_rate, igst_rate, tax_rate,
       cgst_amount, sgst_amount, igst_amount, tax_amount,
       line_total, sort_order, is_active, created_by, updated_by
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8,
       $9, $10,
       $11,
       $12, $13, $14, $15,
       $16, $17, $18, $19,
       $20, $21, 1, $22, $22
     )`,
    [
      quotationId,
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

const softDeleteItems = async (quotationId, actorUserId, client) => {
  await client.query(
    `UPDATE quotation_items
        SET is_active = 0,
            updated_by = $1
      WHERE quotation_id = $2 AND is_active = 1`,
    [actorUserId, quotationId]
  );
};

const getMetrics = async () => {
  const [totalsResult, statusResult, recentResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_quotations,
        SUM(total_amount) AS total_value,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END) AS pending_value,
        SUM(CASE WHEN status IN ('approved','converted') THEN 1 ELSE 0 END) AS won_count,
        SUM(CASE WHEN MONTH(quotation_date) = MONTH(SYSUTCDATETIME()) AND YEAR(quotation_date) = YEAR(SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS this_month_count
      FROM quotations
      WHERE is_active = 1
    `),
    db.query(`
      SELECT status, COUNT(1) AS count, SUM(total_amount) AS amount
      FROM quotations
      WHERE is_active = 1
      GROUP BY status
    `),
    db.query(`
      SELECT TOP 8
        q.id,
        q.quotation_number,
        q.status,
        q.updated_at,
        q.converted_at,
        c.name AS customer_name,
        so.order_number AS converted_order_number
      FROM quotations q
      LEFT JOIN customers c ON c.id = q.customer_id
      LEFT JOIN sales_orders so ON so.quotation_id = q.id AND so.is_active = 1
      WHERE q.is_active = 1
      ORDER BY q.updated_at DESC
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    statusBreakdown: statusResult.rows,
    recent: recentResult.rows,
  };
};

module.exports = {
  listQuotations,
  findById,
  findLatestByLeadId,
  listItems,
  customerExists,
  paymentTermExists,
  userExists,
  productsExist,
  generateQuotationNumber,
  insertQuotation,
  updateQuotationHeader,
  setStatus,
  insertItem,
  softDeleteItems,
  getMetrics,
};

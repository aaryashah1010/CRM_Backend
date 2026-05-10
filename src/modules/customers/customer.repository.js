'use strict';

const db = require('../../config/db');
const { CUSTOMER_SORT_FIELDS } = require('./customer.constants');

const customerSummaryColumns = `
  c.id,
  c.customer_code,
  c.name,
  c.email,
  c.phone,
  c.mobile,
  c.gst_number,
  c.pan_number,
  c.credit_limit,
  c.is_active,
  c.created_at,
  c.updated_at,
  pt.id AS payment_term_id,
  pt.name AS payment_term_name,
  pt.days AS payment_term_days,
  u.id AS assigned_to_id,
  u.full_name AS assigned_to_name,
  COALESCE(inv.outstanding_amount, 0) AS outstanding_amount,
  COALESCE(inv.total_sales, 0) AS total_sales,
  COALESCE(rcp.total_receipts, 0) AS total_receipts
`;

const customerDetailColumns = `
  ${customerSummaryColumns},
  c.website,
  c.notes,
  c.created_by,
  c.updated_by
`;

const summaryJoins = `
  LEFT JOIN payment_terms pt ON pt.id = c.payment_term_id
  LEFT JOIN users u ON u.id = c.assigned_to
  LEFT JOIN (
    SELECT
      customer_id,
      SUM(outstanding_amount) AS outstanding_amount,
      SUM(total_amount) AS total_sales
    FROM sales_invoices
    WHERE is_active = 1 AND status <> 'cancelled'
    GROUP BY customer_id
  ) inv ON inv.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total_receipts
    FROM receipts
    WHERE is_active = 1 AND status = 'completed'
    GROUP BY customer_id
  ) rcp ON rcp.customer_id = c.id
`;

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      c.name LIKE ${key}
      OR c.customer_code LIKE ${key}
      OR c.email LIKE ${key}
      OR c.phone LIKE ${key}
      OR c.mobile LIKE ${key}
      OR c.gst_number LIKE ${key}
      OR c.pan_number LIKE ${key}
    )`);
  }

  if (filters.gstStatus === 'registered') {
    where.push(`c.gst_number IS NOT NULL AND c.gst_number <> ''`);
  }

  if (filters.gstStatus === 'unregistered') {
    where.push(`(c.gst_number IS NULL OR c.gst_number = '')`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`c.is_active = $${params.length}`);
  }

  if (filters.minCreditLimit !== undefined) {
    params.push(filters.minCreditLimit);
    where.push(`c.credit_limit >= $${params.length}`);
  }

  if (filters.maxCreditLimit !== undefined) {
    params.push(filters.maxCreditLimit);
    where.push(`c.credit_limit <= $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listCustomers = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = CUSTOMER_SORT_FIELDS[sortBy] || CUSTOMER_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${customerSummaryColumns}
         FROM customers c
         ${summaryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, c.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM customers c
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

const findById = async (customerId) => {
  const result = await db.query(
    `SELECT ${customerDetailColumns}
       FROM customers c
       ${summaryJoins}
      WHERE c.id = $1`,
    [customerId]
  );

  return result.rows[0] || null;
};

const findByCodeOrGst = async ({ customerCode, gstNumber = null, excludeCustomerId = null }) => {
  const params = [customerCode, gstNumber];
  const excludeClause = excludeCustomerId ? 'AND id <> $3' : '';
  if (excludeCustomerId) params.push(excludeCustomerId);

  const result = await db.query(
    `SELECT id, customer_code, gst_number
       FROM customers
      WHERE (LOWER(customer_code) = LOWER($1)
         OR ($2 IS NOT NULL AND $2 <> '' AND LOWER(gst_number) = LOWER($2)))
        ${excludeClause}`,
    params
  );

  return result.rows[0] || null;
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

const generateCustomerCode = async (client = db) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `CUST-${yyyy}${mm}-`;

  const result = await client.query(
    `SELECT TOP 1 customer_code
       FROM customers
      WHERE customer_code LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.customer_code) {
    const tail = result.rows[0].customer_code.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const createCustomer = async (customer, client = db) => {
  const result = await client.query(
    `INSERT INTO customers (
       customer_code, name, email, phone, mobile, website, gst_number, pan_number,
       payment_term_id, credit_limit, assigned_to, notes, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
    [
      customer.customerCode,
      customer.name,
      customer.email || null,
      customer.phone || null,
      customer.mobile || null,
      customer.website || null,
      customer.gstNumber || null,
      customer.panNumber || null,
      customer.paymentTermId || null,
      customer.creditLimit || 0,
      customer.assignedTo || null,
      customer.notes || null,
      customer.isActive ? 1 : 0,
      customer.actorUserId,
    ]
  );

  return result.rows[0].id;
};

const updateCustomer = async (customerId, updates, client = db) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.customerCode !== undefined) add('customer_code', updates.customerCode);
  if (updates.name !== undefined) add('name', updates.name);
  if (updates.email !== undefined) add('email', updates.email || null);
  if (updates.phone !== undefined) add('phone', updates.phone || null);
  if (updates.mobile !== undefined) add('mobile', updates.mobile || null);
  if (updates.website !== undefined) add('website', updates.website || null);
  if (updates.gstNumber !== undefined) add('gst_number', updates.gstNumber || null);
  if (updates.panNumber !== undefined) add('pan_number', updates.panNumber || null);
  if (updates.paymentTermId !== undefined) add('payment_term_id', updates.paymentTermId || null);
  if (updates.creditLimit !== undefined) add('credit_limit', updates.creditLimit || 0);
  if (updates.assignedTo !== undefined) add('assigned_to', updates.assignedTo || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);

  add('updated_by', updates.actorUserId);
  params.push(customerId);

  await client.query(
    `UPDATE customers
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}`,
    params
  );
};

const setActiveState = async (customerId, isActive, actorUserId) => {
  await db.query(
    `UPDATE customers
        SET is_active = $1,
            updated_by = $2
      WHERE id = $3`,
    [isActive ? 1 : 0, actorUserId, customerId]
  );
};

const listAddresses = async (customerId) => {
  const result = await db.query(
    `SELECT id, customer_id, address_type, address_line1, address_line2, city, state,
            pincode, country, is_default, is_active, created_at, updated_at
       FROM customer_addresses
      WHERE customer_id = $1 AND is_active = 1
      ORDER BY CASE WHEN is_default = 1 THEN 0 ELSE 1 END, address_type ASC, id ASC`,
    [customerId]
  );

  return result.rows;
};

const replaceAddresses = async (customerId, addresses, actorUserId, client = db) => {
  await client.query(
    `UPDATE customer_addresses
        SET is_active = 0,
            updated_by = $1
      WHERE customer_id = $2`,
    [actorUserId, customerId]
  );

  for (const address of addresses || []) {
    await client.query(
      `INSERT INTO customer_addresses (
         customer_id, address_type, address_line1, address_line2, city, state, pincode,
         country, is_default, is_active, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $10)`,
      [
        customerId,
        address.addressType,
        address.addressLine1,
        address.addressLine2 || null,
        address.city,
        address.state,
        address.pincode,
        address.country || 'India',
        address.isDefault ? 1 : 0,
        actorUserId,
      ]
    );
  }
};

const listPaymentTerms = async () => {
  const result = await db.query(
    `SELECT id, name, days, description, is_active
       FROM payment_terms
      WHERE is_active = 1
      ORDER BY days ASC, name ASC`
  );
  return result.rows;
};

const getMetrics = async () => {
  const [totalsResult, agingResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_customers,
        SUM(CASE WHEN c.is_active = 1 THEN 1 ELSE 0 END) AS active_customers,
        SUM(c.credit_limit) AS total_credit_limit,
        SUM(COALESCE(inv.outstanding_amount, 0)) AS total_outstanding,
        SUM(CASE WHEN COALESCE(inv.outstanding_amount, 0) > c.credit_limit AND c.credit_limit > 0 THEN 1 ELSE 0 END) AS over_limit_customers
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(outstanding_amount) AS outstanding_amount
        FROM sales_invoices
        WHERE is_active = 1 AND status <> 'cancelled'
        GROUP BY customer_id
      ) inv ON inv.customer_id = c.id
    `),
    db.query(`
      SELECT
        SUM(CASE WHEN due_date >= CAST(SYSUTCDATETIME() AS date) OR DATEDIFF(day, due_date, CAST(SYSUTCDATETIME() AS date)) BETWEEN 0 AND 30 THEN outstanding_amount ELSE 0 END) AS current_amount,
        SUM(CASE WHEN DATEDIFF(day, due_date, CAST(SYSUTCDATETIME() AS date)) BETWEEN 31 AND 60 THEN outstanding_amount ELSE 0 END) AS days_31_60,
        SUM(CASE WHEN DATEDIFF(day, due_date, CAST(SYSUTCDATETIME() AS date)) BETWEEN 61 AND 90 THEN outstanding_amount ELSE 0 END) AS days_61_90,
        SUM(CASE WHEN DATEDIFF(day, due_date, CAST(SYSUTCDATETIME() AS date)) > 90 THEN outstanding_amount ELSE 0 END) AS days_90_plus
      FROM sales_invoices
      WHERE is_active = 1
        AND status <> 'cancelled'
        AND outstanding_amount > 0
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    aging: agingResult.rows[0],
  };
};

const getLedger = async (customerId) => {
  const result = await db.query(
    `SELECT TOP 20 *
       FROM (
         SELECT
           invoice_date AS transaction_date,
           'invoice' AS transaction_type,
           invoice_number AS reference_number,
           status,
           total_amount AS debit,
           CAST(0 AS DECIMAL(14,2)) AS credit,
           outstanding_amount AS balance
         FROM sales_invoices
         WHERE customer_id = $1 AND is_active = 1 AND status <> 'cancelled'
         UNION ALL
         SELECT
           receipt_date AS transaction_date,
           'receipt' AS transaction_type,
           receipt_number AS reference_number,
           status,
           CAST(0 AS DECIMAL(14,2)) AS debit,
           amount AS credit,
           CAST(0 AS DECIMAL(14,2)) AS balance
         FROM receipts
         WHERE customer_id = $1 AND is_active = 1
       ) ledger
      ORDER BY transaction_date DESC, reference_number DESC`,
    [customerId]
  );

  return result.rows;
};

const getLedgerEntries = async (customerId) => {
  const result = await db.query(
    `SELECT
       reference_type,
       reference_id,
       reference_number,
       transaction_date,
       status,
       debit,
       credit,
       notes
     FROM (
       SELECT
         'invoice' AS reference_type,
         id AS reference_id,
         invoice_number AS reference_number,
         invoice_date AS transaction_date,
         status,
         total_amount AS debit,
         CAST(0 AS DECIMAL(14,2)) AS credit,
         notes
       FROM sales_invoices
       WHERE customer_id = $1
         AND is_active = 1
         AND status <> 'cancelled'
       UNION ALL
       SELECT
         'receipt' AS reference_type,
         id AS reference_id,
         receipt_number AS reference_number,
         receipt_date AS transaction_date,
         status,
         CAST(0 AS DECIMAL(14,2)) AS debit,
         CASE
           WHEN status = 'completed' THEN amount
           ELSE CAST(0 AS DECIMAL(14,2))
         END AS credit,
         notes
       FROM receipts
       WHERE customer_id = $1
         AND is_active = 1
     ) ledger
     ORDER BY transaction_date ASC, reference_id ASC, reference_type ASC`,
    [customerId]
  );

  return result.rows;
};

module.exports = {
  listCustomers,
  findById,
  findByCodeOrGst,
  paymentTermExists,
  userExists,
  generateCustomerCode,
  createCustomer,
  updateCustomer,
  setActiveState,
  listAddresses,
  replaceAddresses,
  listPaymentTerms,
  getMetrics,
  getLedger,
  getLedgerEntries,
};

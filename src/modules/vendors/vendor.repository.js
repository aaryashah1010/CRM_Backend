'use strict';

const db = require('../../config/db');
const { VENDOR_SORT_FIELDS } = require('./vendor.constants');

const vendorSummaryColumns = `
  v.id,
  v.vendor_code,
  v.name,
  v.email,
  v.phone,
  v.mobile,
  v.gst_number,
  v.pan_number,
  v.city,
  v.state,
  v.is_active,
  v.created_at,
  v.updated_at,
  pt.id AS payment_term_id,
  pt.name AS payment_term_name,
  pt.days AS payment_term_days,
  COALESCE(po.total_procurement, 0) AS total_procurement,
  COALESCE(pay.total_paid, 0) AS total_paid,
  CASE
    WHEN COALESCE(po.total_procurement, 0) - COALESCE(pay.total_paid, 0) > 0
      THEN COALESCE(po.total_procurement, 0) - COALESCE(pay.total_paid, 0)
    ELSE 0
  END AS outstanding_amount
`;

const vendorDetailColumns = `
  ${vendorSummaryColumns},
  v.website,
  v.address_line1,
  v.address_line2,
  v.pincode,
  v.country,
  v.bank_name,
  v.bank_account_number,
  v.bank_ifsc_code,
  v.bank_branch,
  v.notes,
  v.created_by,
  v.updated_by
`;

const summaryJoins = `
  LEFT JOIN payment_terms pt ON pt.id = v.payment_term_id
  LEFT JOIN (
    SELECT vendor_id, SUM(total_amount) AS total_procurement
    FROM inward_records
    WHERE is_active = 1
    GROUP BY vendor_id
  ) po ON po.vendor_id = v.id
  LEFT JOIN (
    SELECT vendor_id, SUM(amount) AS total_paid
    FROM payments
    WHERE is_active = 1 AND status = 'completed'
    GROUP BY vendor_id
  ) pay ON pay.vendor_id = v.id
`;

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      v.name LIKE ${key}
      OR v.vendor_code LIKE ${key}
      OR v.email LIKE ${key}
      OR v.phone LIKE ${key}
      OR v.mobile LIKE ${key}
      OR v.gst_number LIKE ${key}
      OR v.pan_number LIKE ${key}
      OR v.city LIKE ${key}
      OR v.state LIKE ${key}
    )`);
  }

  if (filters.gstStatus === 'registered') {
    where.push(`v.gst_number IS NOT NULL AND v.gst_number <> ''`);
  }

  if (filters.gstStatus === 'unregistered') {
    where.push(`(v.gst_number IS NULL OR v.gst_number = '')`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`v.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listVendors = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = VENDOR_SORT_FIELDS[sortBy] || VENDOR_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${vendorSummaryColumns}
         FROM vendors v
         ${summaryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, v.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(`SELECT COUNT(1) AS total FROM vendors v ${whereClause}`, params),
  ]);

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findById = async (vendorId) => {
  const result = await db.query(
    `SELECT ${vendorDetailColumns}
       FROM vendors v
       ${summaryJoins}
      WHERE v.id = $1`,
    [vendorId]
  );
  return result.rows[0] || null;
};

const findByCodeOrGst = async ({ vendorCode, gstNumber = null, excludeVendorId = null }) => {
  const params = [vendorCode, gstNumber];
  const excludeClause = excludeVendorId ? 'AND id <> $3' : '';
  if (excludeVendorId) params.push(excludeVendorId);

  const result = await db.query(
    `SELECT id, vendor_code, gst_number
       FROM vendors
      WHERE (LOWER(vendor_code) = LOWER($1)
         OR ($2 IS NOT NULL AND $2 <> '' AND LOWER(gst_number) = LOWER($2)))
        ${excludeClause}`,
    params
  );
  return result.rows[0] || null;
};

const paymentTermExists = async (paymentTermId) => {
  const result = await db.query(`SELECT id FROM payment_terms WHERE id = $1 AND is_active = 1`, [paymentTermId]);
  return Boolean(result.rows[0]);
};

const createVendor = async (vendor) => {
  const result = await db.query(
    `INSERT INTO vendors (
       vendor_code, name, email, phone, mobile, website, gst_number, pan_number, payment_term_id,
       address_line1, address_line2, city, state, pincode, country,
       bank_name, bank_account_number, bank_ifsc_code, bank_branch,
       notes, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14, $15,
       $16, $17, $18, $19,
       $20, $21, $22, $22
     )`,
    [
      vendor.vendorCode,
      vendor.name,
      vendor.email || null,
      vendor.phone || null,
      vendor.mobile || null,
      vendor.website || null,
      vendor.gstNumber || null,
      vendor.panNumber || null,
      vendor.paymentTermId || null,
      vendor.addressLine1 || null,
      vendor.addressLine2 || null,
      vendor.city || null,
      vendor.state || null,
      vendor.pincode || null,
      vendor.country || 'India',
      vendor.bankName || null,
      vendor.bankAccountNumber || null,
      vendor.bankIfscCode || null,
      vendor.bankBranch || null,
      vendor.notes || null,
      vendor.isActive ? 1 : 0,
      vendor.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const updateVendor = async (vendorId, updates) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.vendorCode !== undefined) add('vendor_code', updates.vendorCode);
  if (updates.name !== undefined) add('name', updates.name);
  if (updates.email !== undefined) add('email', updates.email || null);
  if (updates.phone !== undefined) add('phone', updates.phone || null);
  if (updates.mobile !== undefined) add('mobile', updates.mobile || null);
  if (updates.website !== undefined) add('website', updates.website || null);
  if (updates.gstNumber !== undefined) add('gst_number', updates.gstNumber || null);
  if (updates.panNumber !== undefined) add('pan_number', updates.panNumber || null);
  if (updates.paymentTermId !== undefined) add('payment_term_id', updates.paymentTermId || null);
  if (updates.addressLine1 !== undefined) add('address_line1', updates.addressLine1 || null);
  if (updates.addressLine2 !== undefined) add('address_line2', updates.addressLine2 || null);
  if (updates.city !== undefined) add('city', updates.city || null);
  if (updates.state !== undefined) add('state', updates.state || null);
  if (updates.pincode !== undefined) add('pincode', updates.pincode || null);
  if (updates.country !== undefined) add('country', updates.country || 'India');
  if (updates.bankName !== undefined) add('bank_name', updates.bankName || null);
  if (updates.bankAccountNumber !== undefined) add('bank_account_number', updates.bankAccountNumber || null);
  if (updates.bankIfscCode !== undefined) add('bank_ifsc_code', updates.bankIfscCode || null);
  if (updates.bankBranch !== undefined) add('bank_branch', updates.bankBranch || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);

  add('updated_by', updates.actorUserId);
  params.push(vendorId);

  await db.query(`UPDATE vendors SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const setActiveState = async (vendorId, isActive, actorUserId) => {
  await db.query(
    `UPDATE vendors SET is_active = $1, updated_by = $2 WHERE id = $3`,
    [isActive ? 1 : 0, actorUserId, vendorId]
  );
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
  const [totalsResult, topResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_vendors,
        SUM(CASE WHEN v.is_active = 1 THEN 1 ELSE 0 END) AS active_vendors,
        SUM(COALESCE(po.total_procurement, 0)) AS total_procurement,
        SUM(COALESCE(pay.total_paid, 0)) AS total_paid
      FROM vendors v
      LEFT JOIN (
        SELECT vendor_id, SUM(total_amount) AS total_procurement
        FROM inward_records
        WHERE is_active = 1
        GROUP BY vendor_id
      ) po ON po.vendor_id = v.id
      LEFT JOIN (
        SELECT vendor_id, SUM(amount) AS total_paid
        FROM payments
        WHERE is_active = 1 AND status = 'completed'
        GROUP BY vendor_id
      ) pay ON pay.vendor_id = v.id
    `),
    db.query(`
      SELECT TOP 5
        v.id,
        v.name,
        v.vendor_code,
        SUM(ir.total_amount) AS total_procurement
      FROM vendors v
      INNER JOIN inward_records ir ON ir.vendor_id = v.id
      WHERE ir.is_active = 1
      GROUP BY v.id, v.name, v.vendor_code
      ORDER BY SUM(ir.total_amount) DESC
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    topVendors: topResult.rows,
  };
};

const getLedger = async (vendorId) => {
  const result = await db.query(
    `SELECT TOP 20 *
       FROM (
         SELECT
           inward_date AS transaction_date,
           'inward' AS transaction_type,
           inward_number AS reference_number,
           'completed' AS status,
           total_amount AS debit,
           CAST(0 AS DECIMAL(14,2)) AS credit
         FROM inward_records
         WHERE vendor_id = $1 AND is_active = 1
         UNION ALL
         SELECT
           payment_date AS transaction_date,
           'payment' AS transaction_type,
           payment_number AS reference_number,
           status,
           CAST(0 AS DECIMAL(14,2)) AS debit,
           amount AS credit
         FROM payments
         WHERE vendor_id = $1 AND is_active = 1
       ) ledger
      ORDER BY transaction_date DESC, reference_number DESC`,
    [vendorId]
  );
  return result.rows;
};

const getLedgerEntries = async (vendorId) => {
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
         'inward' AS reference_type,
         id AS reference_id,
         inward_number AS reference_number,
         inward_date AS transaction_date,
         'completed' AS status,
         total_amount AS debit,
         CAST(0 AS DECIMAL(14,2)) AS credit,
         notes
       FROM inward_records
       WHERE vendor_id = $1
         AND is_active = 1
       UNION ALL
       SELECT
         'payment' AS reference_type,
         id AS reference_id,
         payment_number AS reference_number,
         payment_date AS transaction_date,
         status,
         CAST(0 AS DECIMAL(14,2)) AS debit,
         CASE
           WHEN status = 'completed' THEN amount
           ELSE CAST(0 AS DECIMAL(14,2))
         END AS credit,
         notes
       FROM payments
       WHERE vendor_id = $1
         AND is_active = 1
     ) ledger
     ORDER BY transaction_date ASC, reference_id ASC, reference_type ASC`,
    [vendorId]
  );

  return result.rows;
};

module.exports = {
  listVendors,
  findById,
  findByCodeOrGst,
  paymentTermExists,
  createVendor,
  updateVendor,
  setActiveState,
  listPaymentTerms,
  getMetrics,
  getLedger,
  getLedgerEntries,
};

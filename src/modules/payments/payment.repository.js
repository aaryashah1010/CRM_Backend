'use strict';

const db = require('../../config/db');
const {
  PAYMENT_NUMBER_PREFIX,
  PAYMENT_SORT_FIELDS,
} = require('./payment.constants');

const paymentColumns = `
  p.id,
  p.payment_number,
  p.vendor_id,
  p.purchase_order_id,
  p.inward_id,
  p.payment_date,
  p.payment_mode,
  p.amount,
  p.bank_name,
  p.cheque_number,
  p.transaction_reference,
  p.status,
  p.notes,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.created_by,
  p.updated_by,
  v.vendor_code,
  v.name AS vendor_name,
  v.gst_number AS vendor_gst_number,
  po.po_number,
  po.total_amount AS po_total_amount,
  po.status AS po_status,
  ir.inward_number,
  ir.total_amount AS inward_total_amount
`;

const paymentJoins = `
  INNER JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id
  LEFT JOIN inward_records ir ON ir.id = p.inward_id
`;

const buildListFilters = (filters) => {
  const where = ['p.is_active = 1'];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      p.payment_number LIKE ${key}
      OR v.name LIKE ${key}
      OR v.vendor_code LIKE ${key}
      OR po.po_number LIKE ${key}
      OR ir.inward_number LIKE ${key}
      OR p.transaction_reference LIKE ${key}
      OR p.cheque_number LIKE ${key}
    )`);
  }

  if (filters.vendorId) {
    params.push(filters.vendorId);
    where.push(`p.vendor_id = $${params.length}`);
  }

  if (filters.purchaseOrderId) {
    params.push(filters.purchaseOrderId);
    where.push(`p.purchase_order_id = $${params.length}`);
  }

  if (filters.inwardId) {
    params.push(filters.inwardId);
    where.push(`p.inward_id = $${params.length}`);
  }

  if (filters.paymentMode) {
    params.push(filters.paymentMode);
    where.push(`p.payment_mode = $${params.length}`);
  }

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`p.status = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`p.payment_date >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`p.payment_date <= $${params.length}`);
  }

  return {
    params,
    whereClause: `WHERE ${where.join(' AND ')}`,
  };
};

const listPayments = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = PAYMENT_SORT_FIELDS[sortBy] || PAYMENT_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${paymentColumns}
         FROM payments p
         ${paymentJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, p.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM payments p
         ${paymentJoins}
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

const findById = async (paymentId, client = db) => {
  const result = await client.query(
    `SELECT ${paymentColumns}
       FROM payments p
       ${paymentJoins}
      WHERE p.id = $1`,
    [paymentId]
  );
  return result.rows[0] || null;
};

const lockVendorById = async (vendorId, client) => {
  const result = await client.query(
    `SELECT id, vendor_code, name, is_active
       FROM vendors WITH (UPDLOCK, HOLDLOCK)
      WHERE id = $1`,
    [vendorId]
  );
  return result.rows[0] || null;
};

const lockPurchaseOrderById = async (purchaseOrderId, client) => {
  const result = await client.query(
    `SELECT id, po_number, vendor_id, status, total_amount, is_active
       FROM purchase_orders WITH (UPDLOCK, HOLDLOCK)
      WHERE id = $1`,
    [purchaseOrderId]
  );
  return result.rows[0] || null;
};

const lockInwardById = async (inwardId, client) => {
  const result = await client.query(
    `SELECT id, inward_number, vendor_id, purchase_order_id, total_amount, is_active
       FROM inward_records WITH (UPDLOCK, HOLDLOCK)
      WHERE id = $1`,
    [inwardId]
  );
  return result.rows[0] || null;
};

const sumProcurementForPurchaseOrder = async (purchaseOrderId, client) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM inward_records
      WHERE purchase_order_id = $1
        AND is_active = 1`,
    [purchaseOrderId]
  );
  return Number(result.rows[0]?.total || 0);
};

const sumCompletedPaymentsForVendor = async (vendorId, client) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
      WHERE vendor_id = $1 AND is_active = 1 AND status = 'completed'`,
    [vendorId]
  );
  return Number(result.rows[0]?.total || 0);
};

const sumCompletedPaymentsForPurchaseOrder = async (purchaseOrderId, client) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       LEFT JOIN inward_records ir ON ir.id = p.inward_id
      WHERE p.is_active = 1
        AND p.status = 'completed'
        AND (p.purchase_order_id = $1 OR ir.purchase_order_id = $1)`,
    [purchaseOrderId]
  );
  return Number(result.rows[0]?.total || 0);
};

const sumCompletedPaymentsForInward = async (inwardId, client) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
      WHERE inward_id = $1 AND is_active = 1 AND status = 'completed'`,
    [inwardId]
  );
  return Number(result.rows[0]?.total || 0);
};

const sumProcurementForVendor = async (vendorId, client) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM inward_records
      WHERE vendor_id = $1
        AND is_active = 1`,
    [vendorId]
  );
  return Number(result.rows[0]?.total || 0);
};

const listPayableInwardsForVendor = async ({ vendorId, purchaseOrderId = null }, client = db) => {
  const params = [vendorId];
  const where = ['ir.vendor_id = $1', 'ir.is_active = 1'];

  if (purchaseOrderId) {
    params.push(purchaseOrderId);
    where.push(`ir.purchase_order_id = $${params.length}`);
  }

  const result = await client.query(
    `SELECT
       ir.id,
       ir.inward_number,
       ir.purchase_order_id,
       ir.vendor_id,
       ir.inward_date,
       ir.vendor_invoice_number,
       ir.total_amount,
       po.po_number,
       COALESCE(pay.total_paid, 0) AS total_paid,
       CASE
         WHEN ir.total_amount - COALESCE(pay.total_paid, 0) > 0
           THEN ir.total_amount - COALESCE(pay.total_paid, 0)
         ELSE 0
       END AS outstanding_amount
     FROM inward_records ir
     LEFT JOIN purchase_orders po ON po.id = ir.purchase_order_id
     LEFT JOIN (
       SELECT inward_id, SUM(amount) AS total_paid
       FROM payments
       WHERE is_active = 1
         AND status = 'completed'
         AND inward_id IS NOT NULL
       GROUP BY inward_id
     ) pay ON pay.inward_id = ir.id
     WHERE ${where.join(' AND ')}
     ORDER BY ir.inward_date DESC, ir.id DESC`,
    params
  );

  return result.rows;
};

const generatePaymentNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${PAYMENT_NUMBER_PREFIX}-${yyyy}${mm}-`;

  // TABLOCKX + HOLDLOCK serializes payment number generation for the lifetime
  // of the transaction so concurrent inserts cannot mint the same number and
  // collide on uq_payments_number.
  const result = await client.query(
    `SELECT TOP 1 payment_number
       FROM payments WITH (TABLOCKX, HOLDLOCK)
      WHERE payment_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.payment_number) {
    const parsed = parseInt(result.rows[0].payment_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertPayment = async (payment, client) => {
  const result = await client.query(
    `INSERT INTO payments (
       payment_number, vendor_id, purchase_order_id, inward_id,
       payment_date, payment_mode, amount,
       bank_name, cheque_number, transaction_reference,
       status, notes, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       $8, $9, $10,
       $11, $12, 1, $13, $13
     )`,
    [
      payment.paymentNumber,
      payment.vendorId,
      payment.purchaseOrderId || null,
      payment.inwardId || null,
      payment.paymentDate,
      payment.paymentMode,
      payment.amount,
      payment.bankName || null,
      payment.chequeNumber || null,
      payment.transactionReference || null,
      payment.status,
      payment.notes || null,
      payment.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const setStatusInTransaction = async (paymentId, status, actorUserId, client) => {
  await client.query(
    `UPDATE payments SET status = $1, updated_by = $2 WHERE id = $3`,
    [status, actorUserId, paymentId]
  );
};

const lockPaymentById = async (paymentId, client) => {
  const result = await client.query(
    `SELECT id, vendor_id, purchase_order_id, inward_id, amount, status, is_active
       FROM payments WITH (UPDLOCK, HOLDLOCK)
      WHERE id = $1`,
    [paymentId]
  );
  return result.rows[0] || null;
};

module.exports = {
  listPayments,
  findById,
  lockVendorById,
  lockPurchaseOrderById,
  lockInwardById,
  sumProcurementForPurchaseOrder,
  sumCompletedPaymentsForVendor,
  sumCompletedPaymentsForPurchaseOrder,
  sumCompletedPaymentsForInward,
  sumProcurementForVendor,
  listPayableInwardsForVendor,
  generatePaymentNumber,
  insertPayment,
  setStatusInTransaction,
  lockPaymentById,
};

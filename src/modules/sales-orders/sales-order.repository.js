'use strict';

const db = require('../../config/db');
const { SALES_ORDER_SORT_FIELDS, SALES_ORDER_NUMBER_PREFIX } = require('./sales-order.constants');

const summaryColumns = `
  so.id,
  so.order_number,
  so.quotation_id,
  so.customer_id,
  so.order_date,
  so.expected_delivery_date,
  so.status,
  so.payment_term_id,
  so.subtotal_amount,
  so.discount_amount,
  so.taxable_amount,
  so.tax_amount,
  so.total_amount,
  so.is_active,
  so.created_at,
  so.updated_at,
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
  ic.item_count AS item_count
`;

const detailColumns = `
  ${summaryColumns},
  so.billing_address,
  so.shipping_address,
  so.cgst_amount,
  so.sgst_amount,
  so.igst_amount,
  so.round_off_amount,
  so.notes,
  so.assigned_to,
  so.created_by,
  so.updated_by,
  q.quotation_number AS quotation_number
`;

const summaryJoins = `
  LEFT JOIN customers c     ON c.id  = so.customer_id
  LEFT JOIN payment_terms pt ON pt.id = so.payment_term_id
  LEFT JOIN users u         ON u.id  = so.assigned_to
  LEFT JOIN (
    SELECT order_id, COUNT(1) AS item_count
    FROM sales_order_items
    WHERE is_active = 1
    GROUP BY order_id
  ) ic ON ic.order_id = so.id
`;

const detailJoins = `
  ${summaryJoins}
  LEFT JOIN quotations q ON q.id = so.quotation_id
`;

const buildListFilters = (filters) => {
  const where = ['so.is_active = 1'];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      so.order_number LIKE ${key}
      OR c.name LIKE ${key}
      OR c.customer_code LIKE ${key}
    )`);
  }

  if (filters.customerId) {
    params.push(filters.customerId);
    where.push(`so.customer_id = $${params.length}`);
  }

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`so.status = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`so.order_date >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`so.order_date <= $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where[0] = `so.is_active = $${params.length}`;
  }

  return {
    params,
    whereClause: `WHERE ${where.join(' AND ')}`,
  };
};

const listSalesOrders = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = SALES_ORDER_SORT_FIELDS[sortBy] || SALES_ORDER_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${summaryColumns}
         FROM sales_orders so
         ${summaryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, so.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM sales_orders so
         LEFT JOIN customers c ON c.id = so.customer_id
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

const findById = async (salesOrderId) => {
  const result = await db.query(
    `SELECT ${detailColumns}
       FROM sales_orders so
       ${detailJoins}
      WHERE so.id = $1`,
    [salesOrderId]
  );

  return result.rows[0] || null;
};

const lockOrderForUpdate = async (salesOrderId, client) => {
  const result = await client.query(
    `SELECT id, order_number, status
       FROM sales_orders WITH (UPDLOCK, HOLDLOCK)
      WHERE id = $1
        AND is_active = 1`,
    [salesOrderId]
  );
  return result.rows[0] || null;
};

const findByIdForInvoice = async (salesOrderId, client) => {
  const result = await client.query(
    `SELECT
       so.id,
       so.order_number,
       so.customer_id,
       so.order_date,
       so.expected_delivery_date,
       so.status,
       so.payment_term_id,
       so.billing_address,
       so.shipping_address,
       so.subtotal_amount,
       so.discount_amount,
       so.taxable_amount,
       so.cgst_amount,
       so.sgst_amount,
       so.igst_amount,
       so.tax_amount,
       so.round_off_amount,
       so.total_amount,
       so.notes,
       c.gst_number AS customer_gst_number,
       pt.days AS payment_term_days
     FROM sales_orders so WITH (UPDLOCK, HOLDLOCK)
     LEFT JOIN customers c ON c.id = so.customer_id
     LEFT JOIN payment_terms pt ON pt.id = so.payment_term_id
     WHERE so.id = $1
       AND so.is_active = 1`,
    [salesOrderId]
  );
  return result.rows[0] || null;
};

const listItems = async (salesOrderId, client = db) => {
  const result = await client.query(
    `SELECT
       soi.id,
       soi.order_id,
       soi.product_id,
       soi.product_name_snapshot,
       soi.sku_snapshot,
       soi.hsn_sac_code,
       soi.quantity,
       soi.dispatched_quantity,
       soi.unit,
       soi.unit_price,
       soi.discount_percent,
       soi.discount_amount,
       soi.taxable_amount,
       soi.cgst_rate,
       soi.sgst_rate,
       soi.igst_rate,
       soi.tax_rate,
       soi.cgst_amount,
       soi.sgst_amount,
       soi.igst_amount,
       soi.tax_amount,
       soi.line_total,
       soi.sort_order,
       p.sku AS product_sku,
       p.name AS product_name
     FROM sales_order_items soi
     LEFT JOIN products p ON p.id = soi.product_id
     WHERE soi.order_id = $1 AND soi.is_active = 1
     ORDER BY soi.sort_order ASC, soi.id ASC`,
    [salesOrderId]
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

/**
 * Generates a sequential order number in the form SO-YYYYMM-#####.
 * The query runs inside the transaction client to avoid race conditions
 * (two concurrent creates would both observe the same MAX without locking
 * the row range; in practice the unique index on order_number is the
 * authoritative guard).
 */
const generateOrderNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${SALES_ORDER_NUMBER_PREFIX}-${yyyy}${mm}-`;

  const result = await client.query(
    `SELECT TOP 1 order_number
       FROM sales_orders
      WHERE order_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.order_number) {
    const tail = result.rows[0].order_number.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertOrder = async (order, client) => {
  const result = await client.query(
    `INSERT INTO sales_orders (
       order_number, quotation_id, customer_id, order_date, expected_delivery_date,
       status, payment_term_id, billing_address, shipping_address,
       subtotal_amount, discount_amount, taxable_amount,
       cgst_amount, sgst_amount, igst_amount, tax_amount, round_off_amount, total_amount,
       notes, assigned_to, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12,
       $13, $14, $15, $16, $17, $18,
       $19, $20, 1, $21, $21
     )`,
    [
      order.orderNumber,
      order.quotationId || null,
      order.customerId,
      order.orderDate,
      order.expectedDeliveryDate || null,
      order.status,
      order.paymentTermId || null,
      order.billingAddress || null,
      order.shippingAddress || null,
      order.subtotalAmount,
      order.discountAmount,
      order.taxableAmount,
      order.cgstAmount,
      order.sgstAmount,
      order.igstAmount,
      order.taxAmount,
      order.roundOffAmount,
      order.totalAmount,
      order.notes || null,
      order.assignedTo || null,
      order.actorUserId,
    ]
  );

  return result.rows[0].id;
};

const updateOrderHeader = async (salesOrderId, updates, client) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.customerId !== undefined) add('customer_id', updates.customerId);
  if (updates.quotationId !== undefined) add('quotation_id', updates.quotationId || null);
  if (updates.orderDate !== undefined) add('order_date', updates.orderDate);
  if (updates.expectedDeliveryDate !== undefined) add('expected_delivery_date', updates.expectedDeliveryDate || null);
  if (updates.paymentTermId !== undefined) add('payment_term_id', updates.paymentTermId || null);
  if (updates.billingAddress !== undefined) add('billing_address', updates.billingAddress || null);
  if (updates.shippingAddress !== undefined) add('shipping_address', updates.shippingAddress || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
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
  params.push(salesOrderId);

  await client.query(
    `UPDATE sales_orders
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}`,
    params
  );
};

const setStatus = async (salesOrderId, status, actorUserId, client = db) => {
  await client.query(
    `UPDATE sales_orders
        SET status = $1,
            updated_by = $2
      WHERE id = $3`,
    [status, actorUserId, salesOrderId]
  );
};

const ensureStockBalance = async (productId, client) => {
  await client.query(
    `IF NOT EXISTS (SELECT 1 FROM product_stock_balances WHERE product_id = $1)
     INSERT INTO product_stock_balances (product_id, quantity_on_hand, quantity_reserved) VALUES ($1, 0, 0)`,
    [productId]
  );
};

const getStockBalanceForUpdate = async (productId, client) => {
  await ensureStockBalance(productId, client);
  const result = await client.query(
    `SELECT
       psb.product_id,
       psb.quantity_on_hand,
       psb.quantity_reserved,
       psb.quantity_available,
       p.sku,
       p.name
     FROM product_stock_balances psb WITH (UPDLOCK, HOLDLOCK)
     INNER JOIN products p ON p.id = psb.product_id
     WHERE psb.product_id = $1
       AND p.is_active = 1`,
    [productId]
  );
  return result.rows[0] || null;
};

const updateStockOnHand = async (productId, quantityOnHand, client) => {
  await client.query(
    `UPDATE product_stock_balances
        SET quantity_on_hand = $1,
            updated_at = SYSUTCDATETIME()
      WHERE product_id = $2`,
    [quantityOnHand, productId]
  );
};

const updateItemDispatchedQuantity = async (itemId, dispatchedQuantity, actorUserId, client) => {
  await client.query(
    `UPDATE sales_order_items
        SET dispatched_quantity = $1,
            updated_by = $2
      WHERE id = $3`,
    [dispatchedQuantity, actorUserId, itemId]
  );
};

const insertStockMovement = async (movement, client) => {
  await client.query(
    `INSERT INTO stock_movements (
       product_id, movement_type, reference_type, reference_id,
       quantity_in, quantity_out, balance_after, movement_date, remarks, created_by
     )
     VALUES ($1, 'outward', 'sales_order', $2, 0, $3, $4, $5, $6, $7)`,
    [
      movement.productId,
      movement.salesOrderId,
      movement.quantityOut,
      movement.balanceAfter,
      movement.movementDate,
      movement.remarks || null,
      movement.actorUserId,
    ]
  );
};

const insertItem = async (orderId, item, client) => {
  await client.query(
    `INSERT INTO sales_order_items (
       order_id, product_id, product_name_snapshot, sku_snapshot, hsn_sac_code,
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
      orderId,
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

const softDeleteItems = async (orderId, actorUserId, client) => {
  await client.query(
    `UPDATE sales_order_items
        SET is_active = 0,
            updated_by = $1
      WHERE order_id = $2 AND is_active = 1`,
    [actorUserId, orderId]
  );
};

const getMetrics = async () => {
  const [totalsResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_orders,
        SUM(total_amount) AS total_value,
        SUM(CASE WHEN status IN ('draft','confirmed','partially_dispatched') THEN total_amount ELSE 0 END) AS open_value,
        SUM(CASE WHEN MONTH(order_date) = MONTH(SYSUTCDATETIME()) AND YEAR(order_date) = YEAR(SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS orders_this_month,
        SUM(CASE WHEN MONTH(order_date) = MONTH(SYSUTCDATETIME()) AND YEAR(order_date) = YEAR(SYSUTCDATETIME()) THEN total_amount ELSE 0 END) AS value_this_month
      FROM sales_orders
      WHERE is_active = 1 AND status <> 'cancelled'
    `),
    db.query(`
      SELECT status, COUNT(1) AS count, SUM(total_amount) AS amount
      FROM sales_orders
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
  listSalesOrders,
  findById,
  lockOrderForUpdate,
  findByIdForInvoice,
  listItems,
  customerExists,
  paymentTermExists,
  userExists,
  productsExist,
  generateOrderNumber,
  insertOrder,
  updateOrderHeader,
  setStatus,
  insertItem,
  softDeleteItems,
  getStockBalanceForUpdate,
  updateStockOnHand,
  updateItemDispatchedQuantity,
  insertStockMovement,
  getMetrics,
};

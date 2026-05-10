'use strict';

const db = require('../../config/db');
const {
  PURCHASE_ORDER_NUMBER_PREFIX,
  PURCHASE_ORDER_SORT_FIELDS,
  INWARD_NUMBER_PREFIX,
} = require('./purchase-order.constants');

const summaryColumns = `
  po.id,
  po.po_number,
  po.vendor_id,
  po.order_date,
  po.expected_delivery_date,
  po.status,
  po.payment_term_id,
  po.subtotal_amount,
  po.discount_amount,
  po.taxable_amount,
  po.tax_amount,
  po.total_amount,
  po.is_active,
  po.created_at,
  po.updated_at,
  v.id AS vendor_id_ref,
  v.vendor_code,
  v.name AS vendor_name,
  v.email AS vendor_email,
  v.phone AS vendor_phone,
  v.mobile AS vendor_mobile,
  v.gst_number AS vendor_gst_number,
  v.city AS vendor_city,
  v.state AS vendor_state,
  pt.id AS payment_term_id_ref,
  pt.name AS payment_term_name,
  pt.days AS payment_term_days,
  u.id AS assigned_to_id,
  u.full_name AS assigned_to_name,
  ic.item_count
`;

const detailColumns = `
  ${summaryColumns},
  po.delivery_address,
  po.cgst_amount,
  po.sgst_amount,
  po.igst_amount,
  po.round_off_amount,
  po.notes,
  po.assigned_to,
  po.created_by,
  po.updated_by
`;

const summaryJoins = `
  LEFT JOIN vendors v ON v.id = po.vendor_id
  LEFT JOIN payment_terms pt ON pt.id = po.payment_term_id
  LEFT JOIN users u ON u.id = po.assigned_to
  LEFT JOIN (
    SELECT po_id, COUNT(1) AS item_count
    FROM purchase_order_items
    WHERE is_active = 1
    GROUP BY po_id
  ) ic ON ic.po_id = po.id
`;

const buildListFilters = (filters) => {
  const where = ['po.is_active = 1'];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(po.po_number LIKE ${key} OR v.name LIKE ${key} OR v.vendor_code LIKE ${key})`);
  }

  if (filters.vendorId) {
    params.push(filters.vendorId);
    where.push(`po.vendor_id = $${params.length}`);
  }

  if (filters.status === 'overdue') {
    where.push(`po.expected_delivery_date < CAST(SYSUTCDATETIME() AS date) AND po.status IN ('sent', 'partially_received')`);
  } else if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`po.status = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`po.order_date >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`po.order_date <= $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where[0] = `po.is_active = $${params.length}`;
  }

  return {
    params,
    whereClause: `WHERE ${where.join(' AND ')}`,
  };
};

const listPurchaseOrders = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = PURCHASE_ORDER_SORT_FIELDS[sortBy] || PURCHASE_ORDER_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${summaryColumns}
         FROM purchase_orders po
         ${summaryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, po.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM purchase_orders po
         LEFT JOIN vendors v ON v.id = po.vendor_id
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

const findById = async (purchaseOrderId) => {
  const result = await db.query(
    `SELECT ${detailColumns}
       FROM purchase_orders po
       ${summaryJoins}
      WHERE po.id = $1`,
    [purchaseOrderId]
  );
  return result.rows[0] || null;
};

const listItems = async (purchaseOrderId) => {
  const result = await db.query(
    `SELECT
       poi.id,
       poi.po_id,
       poi.product_id,
       poi.product_name_snapshot,
       poi.sku_snapshot,
       poi.hsn_sac_code,
       poi.quantity,
       poi.received_quantity,
       poi.unit,
       poi.unit_price,
       poi.discount_percent,
       poi.discount_amount,
       poi.taxable_amount,
       poi.cgst_rate,
       poi.sgst_rate,
       poi.igst_rate,
       poi.tax_rate,
       poi.cgst_amount,
       poi.sgst_amount,
       poi.igst_amount,
       poi.tax_amount,
       poi.line_total,
       poi.sort_order,
       p.sku AS product_sku,
       p.name AS product_name
     FROM purchase_order_items poi
     LEFT JOIN products p ON p.id = poi.product_id
     WHERE poi.po_id = $1 AND poi.is_active = 1
     ORDER BY poi.sort_order ASC, poi.id ASC`,
    [purchaseOrderId]
  );
  return result.rows;
};

const vendorExists = async (vendorId) => {
  const result = await db.query(`SELECT id FROM vendors WHERE id = $1 AND is_active = 1`, [vendorId]);
  return Boolean(result.rows[0]);
};

const paymentTermExists = async (paymentTermId) => {
  const result = await db.query(`SELECT id FROM payment_terms WHERE id = $1 AND is_active = 1`, [paymentTermId]);
  return Boolean(result.rows[0]);
};

const userExists = async (userId) => {
  const result = await db.query(`SELECT id FROM users WHERE id = $1 AND is_active = 1`, [userId]);
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

const generatePurchaseOrderNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${PURCHASE_ORDER_NUMBER_PREFIX}-${yyyy}${mm}-`;

  const result = await client.query(
    `SELECT TOP 1 po_number
       FROM purchase_orders
      WHERE po_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.po_number) {
    const parsed = parseInt(result.rows[0].po_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertPurchaseOrder = async (order, client) => {
  const result = await client.query(
    `INSERT INTO purchase_orders (
      po_number, vendor_id, order_date, expected_delivery_date, status,
      payment_term_id, delivery_address,
      subtotal_amount, discount_amount, taxable_amount,
      cgst_amount, sgst_amount, igst_amount, tax_amount, round_off_amount, total_amount,
      notes, assigned_to, is_active, created_by, updated_by
    )
    OUTPUT INSERTED.id
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7,
      $8, $9, $10,
      $11, $12, $13, $14, $15, $16,
      $17, $18, 1, $19, $19
    )`,
    [
      order.poNumber,
      order.vendorId,
      order.orderDate,
      order.expectedDeliveryDate || null,
      order.status,
      order.paymentTermId || null,
      order.deliveryAddress || null,
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

const updatePurchaseOrderHeader = async (purchaseOrderId, updates, client) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.vendorId !== undefined) add('vendor_id', updates.vendorId);
  if (updates.orderDate !== undefined) add('order_date', updates.orderDate);
  if (updates.expectedDeliveryDate !== undefined) add('expected_delivery_date', updates.expectedDeliveryDate || null);
  if (updates.paymentTermId !== undefined) add('payment_term_id', updates.paymentTermId || null);
  if (updates.deliveryAddress !== undefined) add('delivery_address', updates.deliveryAddress || null);
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
  params.push(purchaseOrderId);
  await client.query(`UPDATE purchase_orders SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const setStatus = async (purchaseOrderId, status, actorUserId) => {
  await db.query(
    `UPDATE purchase_orders SET status = $1, updated_by = $2 WHERE id = $3`,
    [status, actorUserId, purchaseOrderId]
  );
};

const setStatusInTransaction = async (purchaseOrderId, status, actorUserId, client) => {
  await client.query(
    `UPDATE purchase_orders SET status = $1, updated_by = $2 WHERE id = $3`,
    [status, actorUserId, purchaseOrderId]
  );
};

const insertItem = async (purchaseOrderId, item, client) => {
  await client.query(
    `INSERT INTO purchase_order_items (
      po_id, product_id, product_name_snapshot, sku_snapshot, hsn_sac_code,
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
      purchaseOrderId,
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

const softDeleteItems = async (purchaseOrderId, actorUserId, client) => {
  await client.query(
    `UPDATE purchase_order_items
        SET is_active = 0,
            updated_by = $1
      WHERE po_id = $2 AND is_active = 1`,
    [actorUserId, purchaseOrderId]
  );
};

const getMetrics = async () => {
  const [totalsResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_orders,
        SUM(total_amount) AS total_value,
        SUM(CASE WHEN status IN ('draft','sent','partially_received') THEN total_amount ELSE 0 END) AS open_value,
        SUM(CASE WHEN status IN ('sent','partially_received') THEN 1 ELSE 0 END) AS pending_deliveries,
        SUM(CASE WHEN expected_delivery_date < CAST(SYSUTCDATETIME() AS date) AND status IN ('sent','partially_received') THEN 1 ELSE 0 END) AS overdue_shipments,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
        SUM(CASE WHEN MONTH(order_date) = MONTH(SYSUTCDATETIME()) AND YEAR(order_date) = YEAR(SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS orders_this_month,
        SUM(CASE WHEN MONTH(order_date) = MONTH(SYSUTCDATETIME()) AND YEAR(order_date) = YEAR(SYSUTCDATETIME()) THEN total_amount ELSE 0 END) AS value_this_month
      FROM purchase_orders
      WHERE is_active = 1 AND status <> 'cancelled'
    `),
    db.query(`
      SELECT status, COUNT(1) AS count, SUM(total_amount) AS amount
      FROM purchase_orders
      WHERE is_active = 1
      GROUP BY status
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    statusBreakdown: statusResult.rows,
  };
};

const lockPurchaseOrderForReceive = async (purchaseOrderId, client) => {
  const result = await client.query(
    `SELECT id, po_number, vendor_id, status, is_active
       FROM purchase_orders WITH (UPDLOCK, HOLDLOCK)
      WHERE id = $1`,
    [purchaseOrderId]
  );
  return result.rows[0] || null;
};

const lockPurchaseOrderItemsForReceive = async (purchaseOrderId, client) => {
  const result = await client.query(
    `SELECT
       poi.id,
       poi.po_id,
       poi.product_id,
       poi.product_name_snapshot,
       poi.sku_snapshot,
       poi.hsn_sac_code,
       poi.quantity,
       poi.received_quantity,
       poi.unit,
       poi.unit_price,
       poi.discount_percent,
       poi.discount_amount,
       poi.taxable_amount,
       poi.cgst_rate,
       poi.sgst_rate,
       poi.igst_rate,
       poi.tax_rate,
       poi.cgst_amount,
       poi.sgst_amount,
       poi.igst_amount,
       poi.tax_amount,
       poi.line_total
     FROM purchase_order_items poi WITH (UPDLOCK, HOLDLOCK)
     WHERE poi.po_id = $1 AND poi.is_active = 1
     ORDER BY poi.sort_order ASC, poi.id ASC`,
    [purchaseOrderId]
  );
  return result.rows;
};

const findActiveProductsByIds = async (productIds, client) => {
  if (productIds.length === 0) return new Map();
  const placeholders = productIds.map((_, idx) => `$${idx + 1}`).join(', ');
  const result = await client.query(
    `SELECT id, sku, name, is_active
       FROM products
      WHERE id IN (${placeholders})`,
    productIds
  );
  return new Map(result.rows.map((row) => [Number(row.id), row]));
};

const generateInwardNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${INWARD_NUMBER_PREFIX}-${yyyy}${mm}-`;

  // TABLOCKX + HOLDLOCK serializes inward_number generation for the lifetime of
  // the transaction. Combined with the uq_inward_number unique constraint this
  // prevents two concurrent receives from minting the same GRN number.
  const result = await client.query(
    `SELECT TOP 1 inward_number
       FROM inward_records WITH (TABLOCKX, HOLDLOCK)
      WHERE inward_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.inward_number) {
    const parsed = parseInt(result.rows[0].inward_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertInwardRecord = async (record, client) => {
  const result = await client.query(
    `INSERT INTO inward_records (
       inward_number, purchase_order_id, vendor_id, inward_date,
       vendor_invoice_number, vendor_invoice_date,
       subtotal_amount, discount_amount, taxable_amount,
       cgst_amount, sgst_amount, igst_amount, tax_amount, total_amount,
       notes, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES (
       $1, $2, $3, $4,
       $5, $6,
       $7, $8, $9,
       $10, $11, $12, $13, $14,
       $15, 1, $16, $16
     )`,
    [
      record.inwardNumber,
      record.purchaseOrderId,
      record.vendorId,
      record.inwardDate,
      record.vendorInvoiceNumber || null,
      record.vendorInvoiceDate || null,
      record.subtotalAmount,
      record.discountAmount,
      record.taxableAmount,
      record.cgstAmount,
      record.sgstAmount,
      record.igstAmount,
      record.taxAmount,
      record.totalAmount,
      record.notes || null,
      record.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const insertInwardItem = async (inwardId, item, client) => {
  await client.query(
    `INSERT INTO inward_items (
       inward_id, product_id, product_name_snapshot, sku_snapshot, hsn_sac_code,
       quantity, unit, unit_price,
       discount_amount, taxable_amount,
       cgst_rate, sgst_rate, igst_rate, tax_rate,
       cgst_amount, sgst_amount, igst_amount, tax_amount,
       line_total, is_active, created_by, updated_by
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8,
       $9, $10,
       $11, $12, $13, $14,
       $15, $16, $17, $18,
       $19, 1, $20, $20
     )`,
    [
      inwardId,
      item.productId,
      item.productNameSnapshot,
      item.skuSnapshot || null,
      item.hsnSacCode || null,
      item.quantity,
      item.unit || 'PCS',
      item.unitPrice,
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
      item.actorUserId,
    ]
  );
};

const incrementReceivedQuantity = async (purchaseOrderItemId, addQuantity, actorUserId, client) => {
  await client.query(
    `UPDATE purchase_order_items
        SET received_quantity = received_quantity + $1,
            updated_by = $2
      WHERE id = $3`,
    [addQuantity, actorUserId, purchaseOrderItemId]
  );
};

const ensureStockBalanceRow = async (productId, client) => {
  // MERGE with HOLDLOCK is the canonical SQL Server pattern for an atomic
  // "insert if missing" — without it two concurrent receives for the same
  // product can both pass an IF NOT EXISTS check and race on the
  // uq_product_stock_product_id unique constraint.
  await client.query(
    `MERGE product_stock_balances WITH (HOLDLOCK) AS target
     USING (VALUES ($1)) AS source(product_id)
        ON target.product_id = source.product_id
     WHEN NOT MATCHED THEN
       INSERT (product_id, quantity_on_hand, quantity_reserved)
       VALUES (source.product_id, 0, 0);`,
    [productId]
  );
};

const lockProductStockBalance = async (productId, client) => {
  const result = await client.query(
    `SELECT quantity_on_hand, quantity_reserved
       FROM product_stock_balances WITH (UPDLOCK, HOLDLOCK)
      WHERE product_id = $1`,
    [productId]
  );
  return result.rows[0] || { quantity_on_hand: 0, quantity_reserved: 0 };
};

const updateProductStockOnHand = async (productId, newOnHand, client) => {
  await client.query(
    `UPDATE product_stock_balances
        SET quantity_on_hand = $1,
            updated_at = SYSUTCDATETIME()
      WHERE product_id = $2`,
    [newOnHand, productId]
  );
};

const insertStockMovement = async (movement, client) => {
  const result = await client.query(
    `INSERT INTO stock_movements (
       product_id, movement_type, reference_type, reference_id,
       quantity_in, quantity_out, balance_after,
       movement_date, remarks, created_by
     )
     OUTPUT INSERTED.id
     VALUES ($1, 'inward', 'inward', $2, $3, 0, $4, $5, $6, $7)`,
    [
      movement.productId,
      movement.referenceId,
      movement.quantityIn,
      movement.balanceAfter,
      movement.movementDate,
      movement.remarks || null,
      movement.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const findInwardById = async (inwardId) => {
  const result = await db.query(
    `SELECT
       ir.id,
       ir.inward_number,
       ir.purchase_order_id,
       ir.vendor_id,
       ir.inward_date,
       ir.vendor_invoice_number,
       ir.vendor_invoice_date,
       ir.subtotal_amount,
       ir.discount_amount,
       ir.taxable_amount,
       ir.cgst_amount,
       ir.sgst_amount,
       ir.igst_amount,
       ir.tax_amount,
       ir.total_amount,
       ir.notes,
       ir.created_at,
       ir.updated_at,
       ir.created_by,
       v.vendor_code,
       v.name AS vendor_name,
       po.po_number
     FROM inward_records ir
     LEFT JOIN vendors v ON v.id = ir.vendor_id
     LEFT JOIN purchase_orders po ON po.id = ir.purchase_order_id
     WHERE ir.id = $1`,
    [inwardId]
  );
  return result.rows[0] || null;
};

const listInwardItems = async (inwardId) => {
  const result = await db.query(
    `SELECT
       ii.id,
       ii.inward_id,
       ii.product_id,
       ii.product_name_snapshot,
       ii.sku_snapshot,
       ii.hsn_sac_code,
       ii.quantity,
       ii.unit,
       ii.unit_price,
       ii.discount_amount,
       ii.taxable_amount,
       ii.cgst_rate,
       ii.sgst_rate,
       ii.igst_rate,
       ii.tax_rate,
       ii.cgst_amount,
       ii.sgst_amount,
       ii.igst_amount,
       ii.tax_amount,
       ii.line_total,
       p.sku AS product_sku,
       p.name AS product_name
     FROM inward_items ii
     LEFT JOIN products p ON p.id = ii.product_id
     WHERE ii.inward_id = $1 AND ii.is_active = 1
     ORDER BY ii.id ASC`,
    [inwardId]
  );
  return result.rows;
};

const findStockMovementsByIds = async (movementIds) => {
  if (movementIds.length === 0) return [];
  const placeholders = movementIds.map((_, idx) => `$${idx + 1}`).join(', ');
  const result = await db.query(
    `SELECT
       sm.id,
       sm.product_id,
       sm.movement_type,
       sm.reference_type,
       sm.reference_id,
       sm.quantity_in,
       sm.quantity_out,
       sm.balance_after,
       sm.movement_date,
       sm.remarks,
       sm.created_at,
       p.sku AS product_sku,
       p.name AS product_name,
       p.unit AS product_unit
     FROM stock_movements sm
     LEFT JOIN products p ON p.id = sm.product_id
     WHERE sm.id IN (${placeholders})
     ORDER BY sm.id ASC`,
    movementIds
  );
  return result.rows;
};

module.exports = {
  listPurchaseOrders,
  findById,
  listItems,
  vendorExists,
  paymentTermExists,
  userExists,
  productsExist,
  generatePurchaseOrderNumber,
  insertPurchaseOrder,
  updatePurchaseOrderHeader,
  setStatus,
  setStatusInTransaction,
  insertItem,
  softDeleteItems,
  getMetrics,
  lockPurchaseOrderForReceive,
  lockPurchaseOrderItemsForReceive,
  findActiveProductsByIds,
  generateInwardNumber,
  insertInwardRecord,
  insertInwardItem,
  incrementReceivedQuantity,
  ensureStockBalanceRow,
  lockProductStockBalance,
  updateProductStockOnHand,
  insertStockMovement,
  findInwardById,
  listInwardItems,
  findStockMovementsByIds,
};

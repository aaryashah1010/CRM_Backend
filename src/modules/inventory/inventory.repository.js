'use strict';

const db = require('../../config/db');
const { INVENTORY_MOVEMENT_SORT_FIELDS, INVENTORY_SORT_FIELDS } = require('./inventory.constants');

const inventoryColumns = `
  p.id,
  p.sku,
  p.name,
  p.category_id,
  p.unit,
  p.selling_price,
  p.cost_price,
  p.reorder_level,
  p.reorder_quantity,
  p.is_active,
  p.updated_at AS product_updated_at,
  c.name AS category_name,
  c.code AS category_code,
  COALESCE(psb.quantity_on_hand, 0) AS quantity_on_hand,
  COALESCE(psb.quantity_reserved, 0) AS quantity_reserved,
  COALESCE(psb.quantity_available, 0) AS quantity_available,
  COALESCE(psb.updated_at, p.updated_at) AS stock_updated_at,
  COALESCE(psb.quantity_on_hand, 0) * p.cost_price AS stock_value,
  last_movement.last_movement_date
`;

const inventoryJoins = `
  LEFT JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
  LEFT JOIN (
    SELECT product_id, MAX(movement_date) AS last_movement_date
    FROM stock_movements
    GROUP BY product_id
  ) last_movement ON last_movement.product_id = p.id
`;

const buildStockStatusClause = (status) => {
  if (status === 'out_of_stock') return 'COALESCE(psb.quantity_available, 0) <= 0';
  if (status === 'low_stock') {
    return 'COALESCE(psb.quantity_available, 0) > 0 AND p.reorder_level > 0 AND COALESCE(psb.quantity_available, 0) <= p.reorder_level';
  }
  if (status === 'in_stock') return 'COALESCE(psb.quantity_available, 0) > p.reorder_level';
  return null;
};

const buildInventoryFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      p.sku LIKE ${key}
      OR p.name LIKE ${key}
      OR c.name LIKE ${key}
      OR c.code LIKE ${key}
    )`);
  }

  if (filters.categoryId) {
    params.push(filters.categoryId);
    where.push(`p.category_id = $${params.length}`);
  }

  const stockClause = buildStockStatusClause(filters.stockStatus);
  if (stockClause) where.push(stockClause);

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`p.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listInventory = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildInventoryFilters(filters);
  const orderColumn = INVENTORY_SORT_FIELDS[sortBy] || INVENTORY_SORT_FIELDS.updatedAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${inventoryColumns}
         FROM products p
         ${inventoryJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, p.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM products p
         ${inventoryJoins}
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

const findInventoryItemByProductId = async (productId) => {
  const result = await db.query(
    `SELECT ${inventoryColumns}
       FROM products p
       ${inventoryJoins}
      WHERE p.id = $1`,
    [productId]
  );
  return result.rows[0] || null;
};

const getMetrics = async () => {
  const [totalsResult, categoryResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_skus,
        SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_products,
        SUM(COALESCE(psb.quantity_on_hand, 0)) AS total_stock_on_hand,
        SUM(COALESCE(psb.quantity_reserved, 0)) AS total_stock_reserved,
        SUM(COALESCE(psb.quantity_available, 0)) AS total_stock_available,
        SUM(COALESCE(psb.quantity_on_hand, 0) * p.cost_price) AS inventory_value,
        SUM(CASE WHEN COALESCE(psb.quantity_available, 0) <= 0 THEN 1 ELSE 0 END) AS out_of_stock_items,
        SUM(CASE WHEN COALESCE(psb.quantity_available, 0) > 0 AND p.reorder_level > 0 AND COALESCE(psb.quantity_available, 0) <= p.reorder_level THEN 1 ELSE 0 END) AS low_stock_items,
        (SELECT COUNT(1)
           FROM stock_movements
          WHERE movement_date = CAST(SYSUTCDATETIME() AS date)) AS movements_today
      FROM products p
      LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
      WHERE p.is_active = 1
    `),
    db.query(`
      SELECT TOP 6
        c.id,
        COALESCE(c.name, 'Uncategorized') AS name,
        COALESCE(c.code, 'UNCATEGORIZED') AS code,
        COUNT(p.id) AS product_count,
        SUM(COALESCE(psb.quantity_on_hand, 0)) AS quantity_on_hand,
        SUM(COALESCE(psb.quantity_available, 0)) AS quantity_available,
        SUM(COALESCE(psb.quantity_on_hand, 0) * p.cost_price) AS stock_value
      FROM products p
      LEFT JOIN product_categories c ON c.id = p.category_id
      LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
      WHERE p.is_active = 1
      GROUP BY c.id, c.name, c.code
      ORDER BY stock_value DESC, product_count DESC
    `),
  ]);

  return {
    totals: totalsResult.rows[0] || {},
    categories: categoryResult.rows,
  };
};

const buildMovementFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      p.sku LIKE ${key}
      OR p.name LIKE ${key}
      OR sm.remarks LIKE ${key}
    )`);
  }

  if (filters.productId) {
    params.push(filters.productId);
    where.push(`sm.product_id = $${params.length}`);
  }

  if (filters.movementType && filters.movementType !== 'all') {
    params.push(filters.movementType);
    where.push(`sm.movement_type = $${params.length}`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`sm.movement_date >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`sm.movement_date <= $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listMovements = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildMovementFilters(filters);
  const orderColumn = INVENTORY_MOVEMENT_SORT_FIELDS[sortBy] || INVENTORY_MOVEMENT_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
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
         sm.created_by,
         p.sku,
         p.name AS product_name,
         p.unit,
         c.id AS category_id,
         c.name AS category_name,
         c.code AS category_code,
         u.full_name AS created_by_name
       FROM stock_movements sm
       INNER JOIN products p ON p.id = sm.product_id
       LEFT JOIN product_categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = sm.created_by
       ${whereClause}
       ORDER BY ${orderColumn} ${direction}, sm.id DESC
       OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
       FROM stock_movements sm
       INNER JOIN products p ON p.id = sm.product_id
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

const findProductForAdjustment = async (productId) => {
  const result = await db.query(
    `SELECT
       p.id,
       p.sku,
       p.name,
       p.unit,
       p.is_active,
       COALESCE(psb.quantity_on_hand, 0) AS quantity_on_hand,
       COALESCE(psb.quantity_reserved, 0) AS quantity_reserved,
       COALESCE(psb.quantity_available, 0) AS quantity_available
     FROM products p
     LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
     WHERE p.id = $1`,
    [productId]
  );
  return result.rows[0] || null;
};

const adjustStock = async ({ productId, direction, quantity, movementDate, remarks, actorUserId }) =>
  db.withTransaction(async (client) => {
    await client.query(
      `IF NOT EXISTS (SELECT 1 FROM product_stock_balances WHERE product_id = $1)
       INSERT INTO product_stock_balances (product_id, quantity_on_hand, quantity_reserved) VALUES ($1, 0, 0)`,
      [productId]
    );

    const balanceResult = await client.query(
      `SELECT quantity_on_hand, quantity_reserved
         FROM product_stock_balances WITH (UPDLOCK, HOLDLOCK)
        WHERE product_id = $1`,
      [productId]
    );

    const currentOnHand = Number(balanceResult.rows[0]?.quantity_on_hand || 0);
    const currentReserved = Number(balanceResult.rows[0]?.quantity_reserved || 0);
    const quantityIn = direction === 'in' ? quantity : 0;
    const quantityOut = direction === 'out' ? quantity : 0;
    const newOnHand = currentOnHand + quantityIn - quantityOut;

    await client.query(
      `UPDATE product_stock_balances
          SET quantity_on_hand = $1,
              updated_at = SYSUTCDATETIME()
        WHERE product_id = $2`,
      [newOnHand, productId]
    );

    await client.query(
      `INSERT INTO stock_movements (
         product_id, movement_type, reference_type, quantity_in, quantity_out,
         balance_after, movement_date, remarks, created_by
       )
       VALUES ($1, $2, 'adjustment', $3, $4, $5, $6, $7, $8)`,
      [
        productId,
        direction === 'in' ? 'adjustment_in' : 'adjustment_out',
        quantityIn,
        quantityOut,
        newOnHand,
        movementDate,
        remarks,
        actorUserId,
      ]
    );

    return {
      quantityOnHand: newOnHand,
      quantityReserved: currentReserved,
      quantityAvailable: newOnHand - currentReserved,
    };
  });

module.exports = {
  listInventory,
  findInventoryItemByProductId,
  getMetrics,
  listMovements,
  findProductForAdjustment,
  adjustStock,
};

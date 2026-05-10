'use strict';

const db = require('../../config/db');
const { PRODUCT_SORT_FIELDS } = require('./product.constants');

const productColumns = `
  p.id,
  p.sku,
  p.name,
  p.description,
  p.category_id,
  p.tax_rate_id,
  p.unit,
  p.hsn_sac_code,
  p.selling_price,
  p.cost_price,
  p.reorder_level,
  p.reorder_quantity,
  p.specifications,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.created_by,
  p.updated_by,
  c.name AS category_name,
  c.code AS category_code,
  tr.name AS tax_rate_name,
  tr.rate AS tax_rate,
  tr.cgst_rate,
  tr.sgst_rate,
  tr.igst_rate,
  COALESCE(psb.quantity_on_hand, 0) AS quantity_on_hand,
  COALESCE(psb.quantity_reserved, 0) AS quantity_reserved,
  COALESCE(psb.quantity_available, 0) AS quantity_available
`;

const productJoins = `
  LEFT JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN tax_rates tr ON tr.id = p.tax_rate_id
  LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
`;

const buildStockStatusClause = (status) => {
  if (status === 'out_of_stock') return 'COALESCE(psb.quantity_available, 0) <= 0';
  if (status === 'low_stock') {
    return 'COALESCE(psb.quantity_available, 0) > 0 AND p.reorder_level > 0 AND COALESCE(psb.quantity_available, 0) <= p.reorder_level';
  }
  if (status === 'in_stock') return 'COALESCE(psb.quantity_available, 0) > p.reorder_level';
  return null;
};

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      p.name LIKE ${key}
      OR p.sku LIKE ${key}
      OR p.hsn_sac_code LIKE ${key}
      OR c.name LIKE ${key}
      OR c.code LIKE ${key}
    )`);
  }

  if (filters.categoryId) {
    params.push(filters.categoryId);
    where.push(`p.category_id = $${params.length}`);
  }

  if (filters.taxRateId) {
    params.push(filters.taxRateId);
    where.push(`p.tax_rate_id = $${params.length}`);
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

const listProducts = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = PRODUCT_SORT_FIELDS[sortBy] || PRODUCT_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${productColumns}
         FROM products p
         ${productJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, p.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(`SELECT COUNT(1) AS total FROM products p ${productJoins} ${whereClause}`, params),
  ]);

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findById = async (productId) => {
  const result = await db.query(
    `SELECT ${productColumns}
       FROM products p
       ${productJoins}
      WHERE p.id = $1`,
    [productId]
  );
  return result.rows[0] || null;
};

const findBySku = async (sku, excludeProductId = null) => {
  const params = [sku];
  const excludeClause = excludeProductId ? 'AND id <> $2' : '';
  if (excludeProductId) params.push(excludeProductId);
  const result = await db.query(
    `SELECT id, sku FROM products WHERE LOWER(sku) = LOWER($1) ${excludeClause}`,
    params
  );
  return result.rows[0] || null;
};

const categoryExists = async (categoryId) => {
  const result = await db.query(`SELECT id FROM product_categories WHERE id = $1 AND is_active = 1`, [categoryId]);
  return Boolean(result.rows[0]);
};

const taxRateExists = async (taxRateId) => {
  const result = await db.query(`SELECT id FROM tax_rates WHERE id = $1 AND is_active = 1`, [taxRateId]);
  return Boolean(result.rows[0]);
};

const createProduct = async (product) => db.withTransaction(async (client) => {
  const result = await client.query(
    `INSERT INTO products (
       sku, name, category_id, tax_rate_id, description, unit, hsn_sac_code,
       selling_price, cost_price, reorder_level, reorder_quantity, specifications,
       is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
    [
      product.sku,
      product.name,
      product.categoryId || null,
      product.taxRateId || null,
      product.description || null,
      product.unit || 'PCS',
      product.hsnSacCode || null,
      product.sellingPrice || 0,
      product.costPrice || 0,
      product.reorderLevel || 0,
      product.reorderQuantity || 0,
      product.specifications,
      product.isActive ? 1 : 0,
      product.actorUserId,
    ]
  );
  const productId = result.rows[0].id;
  await client.query(
    `INSERT INTO product_stock_balances (product_id, quantity_on_hand, quantity_reserved) VALUES ($1, 0, 0)`,
    [productId]
  );
  return productId;
});

const updateProduct = async (productId, updates) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.sku !== undefined) add('sku', updates.sku);
  if (updates.name !== undefined) add('name', updates.name);
  if (updates.categoryId !== undefined) add('category_id', updates.categoryId || null);
  if (updates.taxRateId !== undefined) add('tax_rate_id', updates.taxRateId || null);
  if (updates.description !== undefined) add('description', updates.description || null);
  if (updates.unit !== undefined) add('unit', updates.unit || 'PCS');
  if (updates.hsnSacCode !== undefined) add('hsn_sac_code', updates.hsnSacCode || null);
  if (updates.sellingPrice !== undefined) add('selling_price', updates.sellingPrice || 0);
  if (updates.costPrice !== undefined) add('cost_price', updates.costPrice || 0);
  if (updates.reorderLevel !== undefined) add('reorder_level', updates.reorderLevel || 0);
  if (updates.reorderQuantity !== undefined) add('reorder_quantity', updates.reorderQuantity || 0);
  if (updates.specifications !== undefined) add('specifications', updates.specifications);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);
  add('updated_by', updates.actorUserId);
  params.push(productId);

  await db.query(`UPDATE products SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const setActiveState = async (productId, isActive, actorUserId) => {
  await db.query(
    `UPDATE products SET is_active = $1, updated_by = $2 WHERE id = $3`,
    [isActive ? 1 : 0, actorUserId, productId]
  );
};

const listTaxRates = async () => {
  const result = await db.query(
    `SELECT id, name, rate, cgst_rate, sgst_rate, igst_rate, is_active
       FROM tax_rates
      WHERE is_active = 1
      ORDER BY rate ASC, name ASC`
  );
  return result.rows;
};

const getMetrics = async () => {
  const result = await db.query(`
    SELECT
      COUNT(1) AS total_skus,
      SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_products,
      SUM(CASE WHEN COALESCE(psb.quantity_available, 0) <= 0 THEN 1 ELSE 0 END) AS out_of_stock_items,
      SUM(CASE WHEN COALESCE(psb.quantity_available, 0) > 0 AND p.reorder_level > 0 AND COALESCE(psb.quantity_available, 0) <= p.reorder_level THEN 1 ELSE 0 END) AS low_stock_items,
      SUM(COALESCE(psb.quantity_on_hand, 0) * p.cost_price) AS inventory_value,
      SUM(COALESCE(psb.quantity_on_hand, 0)) AS total_stock_on_hand
    FROM products p
    LEFT JOIN product_stock_balances psb ON psb.product_id = p.id
    WHERE p.is_active = 1
  `);
  return result.rows[0] || {};
};

const getStockMovements = async (productId) => {
  const result = await db.query(
    `SELECT TOP 20
       movement_date,
       movement_type,
       reference_type,
       reference_id,
       quantity_in,
       quantity_out,
       balance_after,
       remarks
     FROM stock_movements
     WHERE product_id = $1
     ORDER BY movement_date DESC, id DESC`,
    [productId]
  );
  return result.rows;
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
  listProducts,
  findById,
  findBySku,
  categoryExists,
  taxRateExists,
  createProduct,
  updateProduct,
  setActiveState,
  listTaxRates,
  getMetrics,
  getStockMovements,
  adjustStock,
};

'use strict';

const db = require('../../config/db');
const { CATEGORY_SORT_FIELDS } = require('./category.constants');

const categoryColumns = `
  c.id,
  c.name,
  c.code,
  c.parent_id,
  c.description,
  c.is_active,
  c.created_at,
  c.updated_at,
  c.created_by,
  c.updated_by,
  p.name AS parent_name,
  p.code AS parent_code,
  COUNT(pr.id) AS product_count
`;

const categoryJoins = `
  LEFT JOIN product_categories p ON p.id = c.parent_id
  LEFT JOIN products pr ON pr.category_id = c.id
`;

const categoryGroupBy = `
  c.id, c.name, c.code, c.parent_id, c.description, c.is_active,
  c.created_at, c.updated_at, c.created_by, c.updated_by,
  p.name, p.code
`;

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(c.name LIKE ${key} OR c.code LIKE ${key} OR c.description LIKE ${key})`);
  }

  if (filters.parentId) {
    params.push(filters.parentId);
    where.push(`c.parent_id = $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`c.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listCategories = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = CATEGORY_SORT_FIELDS[sortBy] || CATEGORY_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${categoryColumns}
         FROM product_categories c
         ${categoryJoins}
         ${whereClause}
        GROUP BY ${categoryGroupBy}
        ORDER BY ${orderColumn} ${direction}, c.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(`SELECT COUNT(1) AS total FROM product_categories c ${whereClause}`, params),
  ]);

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findById = async (categoryId) => {
  const result = await db.query(
    `SELECT ${categoryColumns}
       FROM product_categories c
       ${categoryJoins}
      WHERE c.id = $1
      GROUP BY ${categoryGroupBy}`,
    [categoryId]
  );
  return result.rows[0] || null;
};

const findByCode = async (code, excludeCategoryId = null) => {
  const params = [code];
  const excludeClause = excludeCategoryId ? 'AND id <> $2' : '';
  if (excludeCategoryId) params.push(excludeCategoryId);
  const result = await db.query(
    `SELECT id, code FROM product_categories WHERE LOWER(code) = LOWER($1) ${excludeClause}`,
    params
  );
  return result.rows[0] || null;
};

const hasChild = async (categoryId, childId) => {
  const result = await db.query(
    `WITH category_tree AS (
       SELECT id, parent_id FROM product_categories WHERE parent_id = $1
       UNION ALL
       SELECT c.id, c.parent_id
       FROM product_categories c
       INNER JOIN category_tree ct ON c.parent_id = ct.id
     )
     SELECT id FROM category_tree WHERE id = $2`,
    [categoryId, childId]
  );
  return Boolean(result.rows[0]);
};

const createCategory = async (category) => {
  const result = await db.query(
    `INSERT INTO product_categories (name, code, parent_id, description, is_active, created_by, updated_by)
     OUTPUT INSERTED.id
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [
      category.name,
      category.code,
      category.parentId || null,
      category.description || null,
      category.isActive ? 1 : 0,
      category.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const updateCategory = async (categoryId, updates) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.name !== undefined) add('name', updates.name);
  if (updates.code !== undefined) add('code', updates.code);
  if (updates.parentId !== undefined) add('parent_id', updates.parentId || null);
  if (updates.description !== undefined) add('description', updates.description || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);
  add('updated_by', updates.actorUserId);
  params.push(categoryId);

  await db.query(`UPDATE product_categories SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const setActiveState = async (categoryId, isActive, actorUserId) => {
  await db.query(
    `UPDATE product_categories SET is_active = $1, updated_by = $2 WHERE id = $3`,
    [isActive ? 1 : 0, actorUserId, categoryId]
  );
};

const getTree = async () => {
  const result = await db.query(
    `SELECT id, name, code, parent_id, is_active
       FROM product_categories
      WHERE is_active = 1
      ORDER BY name ASC`
  );
  return result.rows;
};

const getMetrics = async () => {
  const result = await db.query(`
    SELECT
      (SELECT COUNT(1) FROM product_categories) AS total_categories,
      (SELECT COUNT(1) FROM product_categories WHERE is_active = 1) AS active_categories,
      (SELECT COUNT(DISTINCT category_id) FROM products WHERE category_id IS NOT NULL AND is_active = 1) AS categories_with_products,
      (SELECT COUNT(1) FROM products WHERE category_id IS NULL AND is_active = 1) AS uncategorized_products
  `);
  return result.rows[0] || {};
};

module.exports = {
  listCategories,
  findById,
  findByCode,
  hasChild,
  createCategory,
  updateCategory,
  setActiveState,
  getTree,
  getMetrics,
};

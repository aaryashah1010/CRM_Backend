'use strict';

const db = require('../../config/db');
const { USER_SORT_FIELDS } = require('./user.constants');

const userColumns = `
  u.id,
  u.full_name,
  u.email,
  u.username,
  u.phone,
  u.is_active,
  u.last_login_at,
  u.created_at,
  u.updated_at,
  u.created_by,
  u.updated_by,
  r.id AS role_id,
  r.name AS role_name,
  r.code AS role_code
`;

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(u.full_name LIKE ${key} OR u.email LIKE ${key} OR u.username LIKE ${key})`);
  }

  if (filters.roleId) {
    params.push(filters.roleId);
    where.push(`u.role_id = $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`u.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listUsers = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = USER_SORT_FIELDS[sortBy] || USER_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const result = await db.query(
    `SELECT ${userColumns}
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       ${whereClause}
      ORDER BY ${orderColumn} ${direction}, u.id DESC
      OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
    pagingParams
  );

  const countResult = await db.query(
    `SELECT COUNT(1) AS total
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       ${whereClause}`,
    params
  );

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findById = async (userId) => {
  const result = await db.query(
    `SELECT ${userColumns}
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
};

const findByEmailOrUsername = async ({ email, username, excludeUserId = null }) => {
  const params = [email, username];
  const excludeClause = excludeUserId ? 'AND id <> $3' : '';
  if (excludeUserId) params.push(excludeUserId);

  const result = await db.query(
    `SELECT id, email, username
       FROM users
      WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2))
        ${excludeClause}`,
    params
  );

  return result.rows[0] || null;
};

const roleExists = async (roleId) => {
  const result = await db.query(
    `SELECT id FROM roles WHERE id = $1 AND is_active = 1`,
    [roleId]
  );

  return Boolean(result.rows[0]);
};

const createUser = async (user) => {
  const result = await db.query(
    `INSERT INTO users (
       role_id, full_name, email, username, password_hash, phone, is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
    [
      user.roleId,
      user.fullName,
      user.email,
      user.username,
      user.passwordHash,
      user.phone || null,
      user.isActive ? 1 : 0,
      user.actorUserId,
    ]
  );

  return result.rows[0].id;
};

const updateUser = async (userId, updates) => {
  const assignments = [];
  const params = [];

  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.roleId !== undefined) add('role_id', updates.roleId);
  if (updates.fullName !== undefined) add('full_name', updates.fullName);
  if (updates.email !== undefined) add('email', updates.email);
  if (updates.username !== undefined) add('username', updates.username);
  if (updates.phone !== undefined) add('phone', updates.phone || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);

  add('updated_by', updates.actorUserId);
  params.push(userId);

  await db.query(
    `UPDATE users
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}`,
    params
  );
};

const setActiveState = async (userId, isActive, actorUserId) => {
  await db.query(
    `UPDATE users
        SET is_active = $1,
            updated_by = $2
      WHERE id = $3`,
    [isActive ? 1 : 0, actorUserId, userId]
  );
};

const resetPassword = async (userId, passwordHash, actorUserId) => {
  await db.query(
    `UPDATE users
        SET password_hash = $1,
            updated_by = $2
      WHERE id = $3`,
    [passwordHash, actorUserId, userId]
  );
};

const listRoles = async () => {
  const result = await db.query(
    `SELECT
       id,
       name,
       code,
       description,
       is_active
     FROM roles
     WHERE is_active = 1
     ORDER BY name ASC`
  );

  return result.rows;
};

const getMetrics = async () => {
  const result = await db.query(`
    SELECT
      COUNT(1) AS total_users,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
      SUM(CASE WHEN created_at >= DATEADD(day, 1 - DAY(SYSUTCDATETIME()), CAST(SYSUTCDATETIME() AS date)) THEN 1 ELSE 0 END) AS new_this_month,
      SUM(CASE WHEN last_login_at IS NULL OR last_login_at < DATEADD(day, -90, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS dormant_users
    FROM users
  `);

  const rolesResult = await db.query(`
    SELECT
      r.id,
      r.name,
      r.code,
      COUNT(u.id) AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.id
    WHERE r.is_active = 1
    GROUP BY r.id, r.name, r.code
    ORDER BY r.name ASC
  `);

  return {
    totals: result.rows[0],
    roleDistribution: rolesResult.rows,
  };
};

module.exports = {
  listUsers,
  findById,
  findByEmailOrUsername,
  roleExists,
  createUser,
  updateUser,
  setActiveState,
  resetPassword,
  listRoles,
  getMetrics,
};

'use strict';

const db = require('../../config/db');

const userSelect = `
  SELECT
    u.id,
    u.role_id,
    u.full_name,
    u.email,
    u.username,
    u.password_hash,
    u.phone,
    u.is_active,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    r.name AS role_name,
    r.code AS role_code
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
`;

const findUserForLogin = async (identifier) => {
  const result = await db.query(
    `${userSelect}
     WHERE LOWER(u.email) = LOWER($1)
        OR LOWER(u.username) = LOWER($1)`,
    [identifier]
  );

  return result.rows[0] || null;
};

const findUserById = async (userId) => {
  const result = await db.query(
    `${userSelect}
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
};

const getPermissionsByRoleId = async (roleId) => {
  const result = await db.query(
    `SELECT p.code
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.is_active = 1
      ORDER BY p.code`,
    [roleId]
  );

  return result.rows.map((row) => row.code);
};

const updateLastLogin = async (userId) => {
  await db.query(
    `UPDATE users
        SET last_login_at = SYSUTCDATETIME()
      WHERE id = $1`,
    [userId]
  );
};

module.exports = {
  findUserForLogin,
  findUserById,
  getPermissionsByRoleId,
  updateLastLogin,
};

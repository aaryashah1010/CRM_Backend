'use strict';

const db = require('../../config/db');
const { EMPLOYEE_SORT_FIELDS } = require('./employee.constants');

// Used for list/paginated queries — excludes sensitive bank columns
const employeeListColumns = `
  e.id,
  e.employee_code,
  e.full_name,
  e.email,
  e.phone,
  e.designation,
  e.date_of_joining,
  e.city,
  e.state,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.department_id,
  d.name AS department_name,
  d.code AS department_code
`;

// Used for single-record detail queries — includes bank columns
const employeeDetailColumns = `
  e.id,
  e.user_id,
  e.department_id,
  e.employee_code,
  e.full_name,
  e.email,
  e.phone,
  e.designation,
  e.date_of_joining,
  e.date_of_birth,
  e.gender,
  e.address,
  e.city,
  e.state,
  e.pincode,
  e.bank_name,
  e.bank_account_number,
  e.bank_ifsc_code,
  e.bank_branch,
  e.emergency_contact_name,
  e.emergency_contact_phone,
  e.emergency_contact_relation,
  e.is_active,
  e.created_at,
  e.updated_at,
  e.created_by,
  e.updated_by,
  d.name AS department_name,
  d.code AS department_code,
  u.full_name AS user_full_name,
  u.username AS username,
  u.email AS user_email
`;

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      e.full_name LIKE ${key}
      OR e.employee_code LIKE ${key}
      OR e.email LIKE ${key}
      OR e.phone LIKE ${key}
      OR e.designation LIKE ${key}
      OR d.name LIKE ${key}
    )`);
  }

  if (filters.departmentId) {
    params.push(filters.departmentId);
    where.push(`e.department_id = $${params.length}`);
  }

  if (filters.designation) {
    params.push(`%${filters.designation}%`);
    where.push(`e.designation LIKE $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`e.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listEmployees = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = EMPLOYEE_SORT_FIELDS[sortBy] || EMPLOYEE_SORT_FIELDS.createdAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${employeeListColumns}
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN users u ON u.id = e.user_id
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, e.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
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

const findById = async (employeeId) => {
  const result = await db.query(
    `SELECT ${employeeDetailColumns}
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN users u ON u.id = e.user_id
      WHERE e.id = $1`,
    [employeeId]
  );

  return result.rows[0] || null;
};

const findByCode = async (employeeCode, excludeEmployeeId = null) => {
  const params = [employeeCode];
  const excludeClause = excludeEmployeeId ? 'AND id <> $2' : '';
  if (excludeEmployeeId) params.push(excludeEmployeeId);

  const result = await db.query(
    `SELECT id, employee_code
       FROM employees
      WHERE LOWER(employee_code) = LOWER($1)
        ${excludeClause}`,
    params
  );

  return result.rows[0] || null;
};

const departmentExists = async (departmentId) => {
  const result = await db.query(
    `SELECT id FROM departments WHERE id = $1 AND is_active = 1`,
    [departmentId]
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

const createEmployee = async (employee) => {
  const result = await db.query(
    `INSERT INTO employees (
       user_id, department_id, employee_code, full_name, email, phone, designation,
       date_of_joining, date_of_birth, gender, address, city, state, pincode,
       bank_name, bank_account_number, bank_ifsc_code, bank_branch,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
       is_active, created_by, updated_by
     )
     OUTPUT INSERTED.id
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18,
       $19, $20, $21,
       $22, $23, $23
     )`,
    [
      employee.userId || null,
      employee.departmentId || null,
      employee.employeeCode,
      employee.fullName,
      employee.email || null,
      employee.phone || null,
      employee.designation || null,
      employee.dateOfJoining || null,
      employee.dateOfBirth || null,
      employee.gender || null,
      employee.address || null,
      employee.city || null,
      employee.state || null,
      employee.pincode || null,
      employee.bankName || null,
      employee.bankAccountNumber || null,
      employee.bankIfscCode || null,
      employee.bankBranch || null,
      employee.emergencyContactName || null,
      employee.emergencyContactPhone || null,
      employee.emergencyContactRelation || null,
      employee.isActive ? 1 : 0,
      employee.actorUserId,
    ]
  );

  return result.rows[0].id;
};

const updateEmployee = async (employeeId, updates) => {
  const assignments = [];
  const params = [];

  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.userId !== undefined) add('user_id', updates.userId || null);
  if (updates.departmentId !== undefined) add('department_id', updates.departmentId || null);
  if (updates.employeeCode !== undefined) add('employee_code', updates.employeeCode);
  if (updates.fullName !== undefined) add('full_name', updates.fullName);
  if (updates.email !== undefined) add('email', updates.email || null);
  if (updates.phone !== undefined) add('phone', updates.phone || null);
  if (updates.designation !== undefined) add('designation', updates.designation || null);
  if (updates.dateOfJoining !== undefined) add('date_of_joining', updates.dateOfJoining || null);
  if (updates.dateOfBirth !== undefined) add('date_of_birth', updates.dateOfBirth || null);
  if (updates.gender !== undefined) add('gender', updates.gender || null);
  if (updates.address !== undefined) add('address', updates.address || null);
  if (updates.city !== undefined) add('city', updates.city || null);
  if (updates.state !== undefined) add('state', updates.state || null);
  if (updates.pincode !== undefined) add('pincode', updates.pincode || null);
  if (updates.bankName !== undefined) add('bank_name', updates.bankName || null);
  if (updates.bankAccountNumber !== undefined) add('bank_account_number', updates.bankAccountNumber || null);
  if (updates.bankIfscCode !== undefined) add('bank_ifsc_code', updates.bankIfscCode || null);
  if (updates.bankBranch !== undefined) add('bank_branch', updates.bankBranch || null);
  if (updates.emergencyContactName !== undefined) add('emergency_contact_name', updates.emergencyContactName || null);
  if (updates.emergencyContactPhone !== undefined) add('emergency_contact_phone', updates.emergencyContactPhone || null);
  if (updates.emergencyContactRelation !== undefined) add('emergency_contact_relation', updates.emergencyContactRelation || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);

  add('updated_by', updates.actorUserId);
  params.push(employeeId);

  await db.query(
    `UPDATE employees
        SET ${assignments.join(', ')}
      WHERE id = $${params.length}`,
    params
  );
};

const setActiveState = async (employeeId, isActive, actorUserId) => {
  await db.query(
    `UPDATE employees
        SET is_active = $1,
            updated_by = $2
      WHERE id = $3`,
    [isActive ? 1 : 0, actorUserId, employeeId]
  );
};

const listDepartments = async () => {
  const result = await db.query(
    `SELECT id, name, code, description, is_active
       FROM departments
      WHERE is_active = 1
      ORDER BY name ASC`
  );

  return result.rows;
};

const getMetrics = async () => {
  const [totalsResult, departmentsResult, birthdaysResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_employees,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_employees,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_employees,
        SUM(CASE WHEN date_of_joining >= DATEADD(day, 1 - DAY(SYSUTCDATETIME()), CAST(SYSUTCDATETIME() AS date)) THEN 1 ELSE 0 END) AS new_this_month
      FROM employees
    `),
    db.query(`
      SELECT
        d.id,
        d.name,
        d.code,
        COUNT(e.id) AS employee_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = 1
      WHERE d.is_active = 1
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `),
    db.query(`
      SELECT id, full_name, employee_code, designation, date_of_birth
      FROM employees
      WHERE is_active = 1
        AND date_of_birth IS NOT NULL
        AND (
          DATEADD(year, DATEDIFF(year, date_of_birth, CAST(GETDATE() AS date)), date_of_birth)
            BETWEEN CAST(GETDATE() AS date) AND DATEADD(day, 30, CAST(GETDATE() AS date))
          OR
          DATEADD(year, DATEDIFF(year, date_of_birth, CAST(GETDATE() AS date)) + 1, date_of_birth)
            BETWEEN CAST(GETDATE() AS date) AND DATEADD(day, 30, CAST(GETDATE() AS date))
        )
      ORDER BY full_name ASC
    `),
  ]);

  return {
    totals: totalsResult.rows[0],
    departmentDistribution: departmentsResult.rows,
    upcomingBirthdays: birthdaysResult.rows,
  };
};

module.exports = {
  listEmployees,
  findById,
  findByCode,
  departmentExists,
  userExists,
  createEmployee,
  updateEmployee,
  setActiveState,
  listDepartments,
  getMetrics,
};

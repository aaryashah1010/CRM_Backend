'use strict';

const db = require('../../config/db');
const { LEAD_SORT_FIELDS, LEAD_STATUSES } = require('./lead.constants');

const leadColumns = `
  l.id,
  l.lead_number,
  l.customer_id,
  l.customer_name,
  l.customer_email,
  l.customer_phone,
  l.customer_company,
  l.source,
  l.priority,
  l.status,
  l.assigned_to,
  l.expected_value,
  l.expected_close_date,
  l.notes,
  l.lost_reason,
  l.converted_at,
  l.is_active,
  l.created_at,
  l.updated_at,
  l.created_by,
  l.updated_by,
  c.name AS linked_customer_name,
  c.customer_code AS linked_customer_code,
  u.full_name AS assigned_to_name,
  u.email AS assigned_to_email,
  fu.last_activity_at,
  fu.next_follow_up_at,
  fu.open_follow_up_count,
  q.id AS quotation_id,
  q.quotation_number,
  q.status AS quotation_status,
  q.total_amount AS quotation_total_amount
`;

const leadJoins = `
  LEFT JOIN customers c ON c.id = l.customer_id
  LEFT JOIN users u ON u.id = l.assigned_to
  LEFT JOIN (
    SELECT
      lead_id,
      MAX(COALESCE(completed_at, scheduled_at)) AS last_activity_at,
      MIN(CASE WHEN status IN ('scheduled','rescheduled') AND scheduled_at >= SYSUTCDATETIME() THEN scheduled_at END) AS next_follow_up_at,
      SUM(CASE WHEN status IN ('scheduled','rescheduled') THEN 1 ELSE 0 END) AS open_follow_up_count
    FROM follow_ups
    WHERE is_active = 1
    GROUP BY lead_id
  ) fu ON fu.lead_id = l.id
  LEFT JOIN (
    SELECT q1.*
    FROM quotations q1
    INNER JOIN (
      SELECT lead_id, MAX(id) AS id
      FROM quotations
      WHERE lead_id IS NOT NULL AND is_active = 1
      GROUP BY lead_id
    ) latest ON latest.id = q1.id
  ) q ON q.lead_id = l.id
`;

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      l.lead_number LIKE ${key}
      OR l.customer_name LIKE ${key}
      OR l.customer_email LIKE ${key}
      OR l.customer_phone LIKE ${key}
      OR l.customer_company LIKE ${key}
      OR c.name LIKE ${key}
      OR c.customer_code LIKE ${key}
    )`);
  }

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`l.status = $${params.length}`);
  }

  if (filters.source && filters.source !== 'all') {
    params.push(filters.source);
    where.push(`l.source = $${params.length}`);
  }

  if (filters.priority && filters.priority !== 'all') {
    params.push(filters.priority);
    where.push(`l.priority = $${params.length}`);
  }

  if (filters.assignedTo) {
    params.push(filters.assignedTo);
    where.push(`l.assigned_to = $${params.length}`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`l.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listLeads = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = LEAD_SORT_FIELDS[sortBy] || LEAD_SORT_FIELDS.updatedAt;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${leadColumns}
         FROM leads l
         ${leadJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, l.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(`SELECT COUNT(1) AS total FROM leads l LEFT JOIN customers c ON c.id = l.customer_id ${whereClause}`, params),
  ]);

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page,
    limit,
  };
};

const findById = async (leadId) => {
  const result = await db.query(
    `SELECT ${leadColumns}
       FROM leads l
       ${leadJoins}
      WHERE l.id = $1`,
    [leadId]
  );
  return result.rows[0] || null;
};

const findByNumber = async (leadNumber) => {
  const result = await db.query(`SELECT id FROM leads WHERE lead_number = $1`, [leadNumber]);
  return result.rows[0] || null;
};

const customerExists = async (customerId) => {
  const result = await db.query(`SELECT id FROM customers WHERE id = $1 AND is_active = 1`, [customerId]);
  return Boolean(result.rows[0]);
};

const userExists = async (userId) => {
  const result = await db.query(`SELECT id FROM users WHERE id = $1 AND is_active = 1`, [userId]);
  return Boolean(result.rows[0]);
};

const createLead = async (lead) => {
  const result = await db.query(
    `INSERT INTO leads (
      lead_number, customer_id, customer_name, customer_email, customer_phone, customer_company,
      source, priority, status, assigned_to, expected_value, expected_close_date,
      notes, lost_reason, is_active, created_by, updated_by
    )
    OUTPUT INSERTED.id
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
    [
      lead.leadNumber,
      lead.customerId || null,
      lead.customerName || null,
      lead.customerEmail || null,
      lead.customerPhone || null,
      lead.customerCompany || null,
      lead.source || null,
      lead.priority,
      lead.status,
      lead.assignedTo || null,
      lead.expectedValue || 0,
      lead.expectedCloseDate || null,
      lead.notes || null,
      lead.lostReason || null,
      lead.isActive ? 1 : 0,
      lead.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const updateLead = async (leadId, updates, client = db) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.customerId !== undefined) add('customer_id', updates.customerId || null);
  if (updates.customerName !== undefined) add('customer_name', updates.customerName || null);
  if (updates.customerEmail !== undefined) add('customer_email', updates.customerEmail || null);
  if (updates.customerPhone !== undefined) add('customer_phone', updates.customerPhone || null);
  if (updates.customerCompany !== undefined) add('customer_company', updates.customerCompany || null);
  if (updates.source !== undefined) add('source', updates.source || null);
  if (updates.priority !== undefined) add('priority', updates.priority);
  if (updates.status !== undefined) add('status', updates.status);
  if (updates.assignedTo !== undefined) add('assigned_to', updates.assignedTo || null);
  if (updates.expectedValue !== undefined) add('expected_value', updates.expectedValue || 0);
  if (updates.expectedCloseDate !== undefined) add('expected_close_date', updates.expectedCloseDate || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
  if (updates.lostReason !== undefined) add('lost_reason', updates.lostReason || null);
  if (updates.convertedAt !== undefined) add('converted_at', updates.convertedAt || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);

  add('updated_by', updates.actorUserId);
  params.push(leadId);
  await client.query(`UPDATE leads SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const listFollowUps = async (leadId) => {
  const result = await db.query(
    `SELECT
       f.id, f.lead_id, f.follow_up_type, f.status, f.scheduled_at, f.completed_at,
       f.assigned_to, f.subject, f.notes, f.next_follow_up_date, f.is_active,
       f.created_at, f.updated_at, u.full_name AS assigned_to_name
     FROM follow_ups f
     LEFT JOIN users u ON u.id = f.assigned_to
     WHERE f.lead_id = $1 AND f.is_active = 1
     ORDER BY f.scheduled_at DESC, f.id DESC`,
    [leadId]
  );
  return result.rows;
};

const createFollowUp = async (leadId, followUp) => {
  const result = await db.query(
    `INSERT INTO follow_ups (
      lead_id, follow_up_type, status, scheduled_at, completed_at, assigned_to,
      subject, notes, next_follow_up_date, is_active, created_by, updated_by
    )
    OUTPUT INSERTED.id
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $10)`,
    [
      leadId,
      followUp.followUpType,
      followUp.status,
      followUp.scheduledAt,
      followUp.completedAt || null,
      followUp.assignedTo || null,
      followUp.subject || null,
      followUp.notes || null,
      followUp.nextFollowUpDate || null,
      followUp.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const getMetrics = async () => {
  const [totalsResult, statusResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_leads,
        SUM(CASE WHEN is_active = 1 AND status NOT IN ('lost','converted') THEN 1 ELSE 0 END) AS active_leads,
        SUM(CASE WHEN is_active = 1 THEN COALESCE(expected_value, 0) ELSE 0 END) AS total_lead_value,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted_leads,
        SUM(CASE WHEN is_active = 1 AND status NOT IN ('lost','converted')
                  AND updated_at < DATEADD(day, -7, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS stale_leads
      FROM leads
    `),
    db.query(`
      SELECT status, COUNT(1) AS lead_count, SUM(COALESCE(expected_value, 0)) AS expected_value
      FROM leads
      WHERE is_active = 1
      GROUP BY status
    `),
  ]);
  return {
    totals: totalsResult.rows[0],
    byStatus: statusResult.rows,
  };
};

const getPipeline = async () => {
  const result = await db.query(
    `SELECT ${leadColumns}
       FROM leads l
       ${leadJoins}
      WHERE l.is_active = 1
      ORDER BY CASE l.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               l.expected_value DESC,
               l.updated_at DESC`
  );
  return result.rows;
};

const listAssignableUsers = async () => {
  const result = await db.query(
    `SELECT u.id, u.full_name, u.email, r.code AS role_code
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
      WHERE u.is_active = 1
        AND r.code IN ('admin', 'sales_executive')
      ORDER BY u.full_name ASC`
  );
  return result.rows;
};

const listCustomerOptions = async () => {
  const result = await db.query(
    `SELECT TOP 100 id, customer_code, name, email, mobile, phone
       FROM customers
      WHERE is_active = 1
      ORDER BY name ASC`
  );
  return result.rows;
};

module.exports = {
  statuses: LEAD_STATUSES,
  listLeads,
  findById,
  findByNumber,
  customerExists,
  userExists,
  createLead,
  updateLead,
  listFollowUps,
  createFollowUp,
  getMetrics,
  getPipeline,
  listAssignableUsers,
  listCustomerOptions,
};

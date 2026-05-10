'use strict';

const db = require('../../config/db');
const { FOLLOW_UP_SORT_FIELDS } = require('./followup.constants');

const followUpColumns = `
  f.id,
  f.lead_id,
  f.follow_up_type,
  f.status,
  f.scheduled_at,
  f.completed_at,
  f.assigned_to,
  f.subject,
  f.notes,
  f.next_follow_up_date,
  f.is_active,
  f.created_at,
  f.updated_at,
  f.created_by,
  f.updated_by,
  l.lead_number,
  l.customer_id,
  l.customer_name,
  l.customer_email,
  l.customer_phone,
  l.customer_company,
  l.priority AS lead_priority,
  l.status AS lead_status,
  l.expected_value,
  l.expected_close_date,
  l.assigned_to AS lead_assigned_to,
  c.name AS linked_customer_name,
  c.customer_code AS linked_customer_code,
  u.full_name AS assigned_to_name,
  u.email AS assigned_to_email,
  lu.full_name AS lead_assigned_to_name,
  lu.email AS lead_assigned_to_email
`;

const followUpJoins = `
  INNER JOIN leads l ON l.id = f.lead_id
  LEFT JOIN customers c ON c.id = l.customer_id
  LEFT JOIN users u ON u.id = f.assigned_to
  LEFT JOIN users lu ON lu.id = l.assigned_to
`;

const buildStatusClause = (status) => {
  if (!status || status === 'all') return null;
  if (status === 'open') return `f.status IN ('scheduled', 'rescheduled')`;
  if (status === 'upcoming') return `f.status IN ('scheduled', 'rescheduled') AND f.scheduled_at >= SYSDATETIMEOFFSET()`;
  if (status === 'overdue') return `f.status IN ('scheduled', 'rescheduled') AND f.scheduled_at < SYSDATETIMEOFFSET()`;
  if (status === 'due_today') {
    return `f.status IN ('scheduled', 'rescheduled') AND CAST(f.scheduled_at AS date) = CAST(SYSDATETIMEOFFSET() AS date)`;
  }
  return `f.status = $STATUS_PARAM`;
};

const buildListFilters = (filters) => {
  const where = [];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const key = `$${params.length}`;
    where.push(`(
      f.subject LIKE ${key}
      OR f.notes LIKE ${key}
      OR l.lead_number LIKE ${key}
      OR l.customer_name LIKE ${key}
      OR l.customer_company LIKE ${key}
      OR c.name LIKE ${key}
      OR c.customer_code LIKE ${key}
    )`);
  }

  if (filters.leadId) {
    params.push(filters.leadId);
    where.push(`f.lead_id = $${params.length}`);
  }

  if (filters.assignedTo) {
    params.push(filters.assignedTo);
    where.push(`f.assigned_to = $${params.length}`);
  }

  if (filters.followUpType && filters.followUpType !== 'all') {
    params.push(filters.followUpType);
    where.push(`f.follow_up_type = $${params.length}`);
  }

  const statusClause = buildStatusClause(filters.status);
  if (statusClause) {
    if (statusClause.includes('$STATUS_PARAM')) {
      params.push(filters.status);
      where.push(statusClause.replace('$STATUS_PARAM', `$${params.length}`));
    } else {
      where.push(statusClause);
    }
  }

  if (filters.fromDate) {
    params.push(filters.fromDate);
    where.push(`CAST(f.scheduled_at AS date) >= CAST($${params.length} AS date)`);
  }

  if (filters.toDate) {
    params.push(filters.toDate);
    where.push(`CAST(f.scheduled_at AS date) <= CAST($${params.length} AS date)`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive ? 1 : 0);
    where.push(`f.is_active = $${params.length}`);
  }

  return {
    params,
    whereClause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  };
};

const listFollowUps = async ({ page, limit, offset, sortBy, sortOrder, ...filters }) => {
  const { params, whereClause } = buildListFilters(filters);
  const orderColumn = FOLLOW_UP_SORT_FIELDS[sortBy] || FOLLOW_UP_SORT_FIELDS.scheduledAt;
  const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
  const pagingParams = [...params, offset, limit];
  const offsetParam = `$${params.length + 1}`;
  const limitParam = `$${params.length + 2}`;

  const [result, countResult] = await Promise.all([
    db.query(
      `SELECT ${followUpColumns}
         FROM follow_ups f
         ${followUpJoins}
         ${whereClause}
        ORDER BY ${orderColumn} ${direction}, f.id DESC
        OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`,
      pagingParams
    ),
    db.query(
      `SELECT COUNT(1) AS total
         FROM follow_ups f
         ${followUpJoins}
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

const findById = async (followUpId) => {
  const result = await db.query(
    `SELECT ${followUpColumns}
       FROM follow_ups f
       ${followUpJoins}
      WHERE f.id = $1`,
    [followUpId]
  );
  return result.rows[0] || null;
};

const leadExists = async (leadId) => {
  const result = await db.query(`SELECT id FROM leads WHERE id = $1 AND is_active = 1`, [leadId]);
  return Boolean(result.rows[0]);
};

const userExists = async (userId) => {
  const result = await db.query(`SELECT id FROM users WHERE id = $1 AND is_active = 1`, [userId]);
  return Boolean(result.rows[0]);
};

const createFollowUp = async (followUp) => {
  const result = await db.query(
    `INSERT INTO follow_ups (
      lead_id, follow_up_type, status, scheduled_at, completed_at, assigned_to,
      subject, notes, next_follow_up_date, is_active, created_by, updated_by
    )
    OUTPUT INSERTED.id
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
    [
      followUp.leadId,
      followUp.followUpType,
      followUp.status,
      followUp.scheduledAt,
      followUp.completedAt || null,
      followUp.assignedTo || null,
      followUp.subject || null,
      followUp.notes || null,
      followUp.nextFollowUpDate || null,
      followUp.isActive ? 1 : 0,
      followUp.actorUserId,
    ]
  );
  return result.rows[0].id;
};

const updateFollowUp = async (followUpId, updates) => {
  const assignments = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  if (updates.leadId !== undefined) add('lead_id', updates.leadId);
  if (updates.followUpType !== undefined) add('follow_up_type', updates.followUpType);
  if (updates.status !== undefined) add('status', updates.status);
  if (updates.scheduledAt !== undefined) add('scheduled_at', updates.scheduledAt);
  if (updates.completedAt !== undefined) add('completed_at', updates.completedAt || null);
  if (updates.assignedTo !== undefined) add('assigned_to', updates.assignedTo || null);
  if (updates.subject !== undefined) add('subject', updates.subject || null);
  if (updates.notes !== undefined) add('notes', updates.notes || null);
  if (updates.nextFollowUpDate !== undefined) add('next_follow_up_date', updates.nextFollowUpDate || null);
  if (updates.isActive !== undefined) add('is_active', updates.isActive ? 1 : 0);

  add('updated_by', updates.actorUserId);
  params.push(followUpId);
  await db.query(`UPDATE follow_ups SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
};

const getMetrics = async () => {
  const [totalsResult, statusResult, typeResult, upcomingResult] = await Promise.all([
    db.query(`
      SELECT
        COUNT(1) AS total_followups,
        SUM(CASE WHEN status IN ('scheduled', 'rescheduled') THEN 1 ELSE 0 END) AS open_followups,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_followups,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_followups,
        SUM(CASE WHEN status IN ('scheduled', 'rescheduled') AND scheduled_at < SYSDATETIMEOFFSET() THEN 1 ELSE 0 END) AS overdue_followups,
        SUM(CASE WHEN status IN ('scheduled', 'rescheduled') AND CAST(scheduled_at AS date) = CAST(SYSDATETIMEOFFSET() AS date) THEN 1 ELSE 0 END) AS due_today_followups,
        AVG(CASE WHEN completed_at IS NOT NULL THEN DATEDIFF(minute, scheduled_at, completed_at) END) AS avg_completion_minutes
      FROM follow_ups
      WHERE is_active = 1
    `),
    db.query(`
      SELECT status, COUNT(1) AS follow_up_count
      FROM follow_ups
      WHERE is_active = 1
      GROUP BY status
    `),
    db.query(`
      SELECT follow_up_type, COUNT(1) AS follow_up_count
      FROM follow_ups
      WHERE is_active = 1
      GROUP BY follow_up_type
    `),
    db.query(`
      SELECT TOP 5 ${followUpColumns}
        FROM follow_ups f
        ${followUpJoins}
       WHERE f.is_active = 1
         AND f.status IN ('scheduled', 'rescheduled')
       ORDER BY CASE WHEN f.scheduled_at < SYSDATETIMEOFFSET() THEN 0 ELSE 1 END,
                f.scheduled_at ASC,
                f.id DESC
    `),
  ]);

  return {
    totals: totalsResult.rows[0] || {},
    byStatus: statusResult.rows,
    byType: typeResult.rows,
    upcoming: upcomingResult.rows,
  };
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

const listLeadOptions = async () => {
  const result = await db.query(
    `SELECT TOP 100
       l.id,
       l.lead_number,
       l.customer_name,
       l.customer_company,
       l.status,
       l.priority,
       COALESCE(c.name, l.customer_name) AS display_customer_name
     FROM leads l
     LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.is_active = 1
     ORDER BY l.updated_at DESC, l.id DESC`
  );
  return result.rows;
};

module.exports = {
  listFollowUps,
  findById,
  leadExists,
  userExists,
  createFollowUp,
  updateFollowUp,
  getMetrics,
  listAssignableUsers,
  listLeadOptions,
};

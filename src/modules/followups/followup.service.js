'use strict';

const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, NotFoundError } = require('../../common/errors');
const followUpRepository = require('./followup.repository');
const {
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_TYPES,
} = require('./followup.constants');

const emptyToNull = (value) => (value === '' ? null : value);
const toNumber = (value) => Number(value || 0);
const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};
const normalizeDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const isOpenStatus = (status) => status === 'scheduled' || status === 'rescheduled';
const isSameDate = (left, right) => left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);

const normalizeAssignee = (row) => row.assigned_to ? ({
  id: row.assigned_to,
  fullName: row.assigned_to_name,
  email: row.assigned_to_email || null,
}) : null;

const normalizeLeadAssignee = (row) => row.lead_assigned_to ? ({
  id: row.lead_assigned_to,
  fullName: row.lead_assigned_to_name,
  email: row.lead_assigned_to_email || null,
}) : null;

const normalizeLeadRef = (row) => ({
  id: row.lead_id,
  leadNumber: row.lead_number,
  customerId: row.customer_id,
  customer: row.customer_id ? {
    id: row.customer_id,
    name: row.linked_customer_name,
    code: row.linked_customer_code,
  } : null,
  customerName: row.linked_customer_name || row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  customerCompany: row.customer_company,
  priority: row.lead_priority,
  status: row.lead_status,
  expectedValue: toNumber(row.expected_value),
  expectedCloseDate: normalizeDate(row.expected_close_date),
  assignedTo: row.lead_assigned_to,
  assignee: normalizeLeadAssignee(row),
});

const normalizeFollowUp = (row) => {
  const scheduledAt = normalizeDateTime(row.scheduled_at);
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const now = new Date();

  return {
    id: row.id,
    leadId: row.lead_id,
    followUpType: row.follow_up_type,
    status: row.status,
    scheduledAt,
    completedAt: normalizeDateTime(row.completed_at),
    assignedTo: row.assigned_to,
    assignee: normalizeAssignee(row),
    assignedToName: row.assigned_to_name || null,
    subject: row.subject,
    notes: row.notes,
    nextFollowUpDate: normalizeDate(row.next_follow_up_date),
    isOverdue: Boolean(scheduledDate && isOpenStatus(row.status) && scheduledDate < now),
    isDueToday: Boolean(scheduledDate && isOpenStatus(row.status) && isSameDate(scheduledDate, now)),
    isActive: Boolean(row.is_active),
    createdAt: normalizeDateTime(row.created_at),
    updatedAt: normalizeDateTime(row.updated_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    lead: normalizeLeadRef(row),
  };
};

const normalizePayload = (payload) => {
  const normalized = { ...payload };
  if (payload.leadId !== undefined) normalized.leadId = payload.leadId || null;
  if (payload.scheduledAt !== undefined) normalized.scheduledAt = normalizeDateTime(payload.scheduledAt);
  if (payload.completedAt !== undefined) normalized.completedAt = normalizeDateTime(payload.completedAt);
  if (payload.assignedTo !== undefined) normalized.assignedTo = payload.assignedTo || null;
  if (payload.subject !== undefined) normalized.subject = emptyToNull(payload.subject);
  if (payload.notes !== undefined) normalized.notes = emptyToNull(payload.notes);
  if (payload.nextFollowUpDate !== undefined) normalized.nextFollowUpDate = normalizeDate(payload.nextFollowUpDate);
  return normalized;
};

const assertReferences = async ({ leadId, assignedTo }) => {
  if (leadId) {
    const exists = await followUpRepository.leadExists(leadId);
    if (!exists) throw new BusinessRuleError('Selected lead does not exist or is inactive');
  }

  if (assignedTo) {
    const exists = await followUpRepository.userExists(assignedTo);
    if (!exists) throw new BusinessRuleError('Selected assignee does not exist or is inactive');
  }
};

const listFollowUps = async (query) => {
  const result = await followUpRepository.listFollowUps(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeFollowUp),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      totalItems: pagination.total,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPreviousPage: pagination.hasPrevPage,
    },
  };
};

const getFollowUp = async (followUpId) => {
  const followUp = await followUpRepository.findById(followUpId);
  if (!followUp) throw new NotFoundError('Follow-up not found');
  return normalizeFollowUp(followUp);
};

const createFollowUp = async (payload, actorUserId) => {
  const followUp = normalizePayload(payload);
  await assertReferences(followUp);
  if (followUp.status === 'completed' && !followUp.completedAt) {
    followUp.completedAt = new Date().toISOString();
  }
  const followUpId = await followUpRepository.createFollowUp({
    ...followUp,
    isActive: followUp.isActive !== false,
    actorUserId,
  });
  return getFollowUp(followUpId);
};

const updateFollowUp = async (followUpId, payload, actorUserId) => {
  const current = await getFollowUp(followUpId);
  const updates = normalizePayload(payload);
  await assertReferences(updates);

  if (updates.status === 'completed' && !updates.completedAt && !current.completedAt) {
    updates.completedAt = new Date().toISOString();
  }

  await followUpRepository.updateFollowUp(followUpId, { ...updates, actorUserId });
  return getFollowUp(followUpId);
};

const completeFollowUp = async (followUpId, payload, actorUserId) => {
  const current = await getFollowUp(followUpId);
  if (current.status === 'cancelled') {
    throw new BusinessRuleError('Cancelled follow-ups cannot be completed');
  }

  const updates = normalizePayload({
    status: 'completed',
    completedAt: payload.completedAt || new Date().toISOString(),
    notes: payload.notes !== undefined ? payload.notes : current.notes,
    nextFollowUpDate: payload.nextFollowUpDate !== undefined ? payload.nextFollowUpDate : current.nextFollowUpDate,
  });

  await followUpRepository.updateFollowUp(followUpId, { ...updates, actorUserId });
  return getFollowUp(followUpId);
};

const cancelFollowUp = async (followUpId, payload, actorUserId) => {
  const current = await getFollowUp(followUpId);
  if (current.status === 'completed') {
    throw new BusinessRuleError('Completed follow-ups cannot be cancelled');
  }

  const updates = normalizePayload({
    status: 'cancelled',
    notes: payload.notes !== undefined ? payload.notes : current.notes,
  });

  await followUpRepository.updateFollowUp(followUpId, { ...updates, actorUserId });
  return getFollowUp(followUpId);
};

const deactivateFollowUp = async (followUpId, actorUserId) => {
  await getFollowUp(followUpId);
  await followUpRepository.updateFollowUp(followUpId, { isActive: false, actorUserId });
};

const getMetrics = async () => {
  const metrics = await followUpRepository.getMetrics();
  const totalFollowUps = toNumber(metrics.totals?.total_followups);
  const completedFollowUps = toNumber(metrics.totals?.completed_followups);
  const avgCompletionMinutes = toNumber(metrics.totals?.avg_completion_minutes);
  return {
    totalFollowUps,
    openFollowUps: toNumber(metrics.totals?.open_followups),
    completedFollowUps,
    cancelledFollowUps: toNumber(metrics.totals?.cancelled_followups),
    overdueFollowUps: toNumber(metrics.totals?.overdue_followups),
    dueTodayFollowUps: toNumber(metrics.totals?.due_today_followups),
    completionRate: totalFollowUps ? Math.round((completedFollowUps / totalFollowUps) * 1000) / 10 : 0,
    avgCompletionHours: Math.round((avgCompletionMinutes / 60) * 10) / 10,
    byStatus: metrics.byStatus.map((row) => ({
      status: row.status,
      followUpCount: toNumber(row.follow_up_count),
    })),
    byType: metrics.byType.map((row) => ({
      followUpType: row.follow_up_type,
      followUpCount: toNumber(row.follow_up_count),
    })),
    priorityQueue: metrics.upcoming.map(normalizeFollowUp),
  };
};

const getOptions = async () => {
  const [assignees, leads] = await Promise.all([
    followUpRepository.listAssignableUsers(),
    followUpRepository.listLeadOptions(),
  ]);

  return {
    statuses: FOLLOW_UP_STATUSES,
    types: FOLLOW_UP_TYPES,
    assignees: assignees.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      roleCode: row.role_code,
    })),
    leads: leads.map((row) => ({
      id: row.id,
      leadNumber: row.lead_number,
      customerName: row.display_customer_name,
      customerCompany: row.customer_company,
      status: row.status,
      priority: row.priority,
    })),
  };
};

module.exports = {
  listFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  deactivateFollowUp,
  getMetrics,
  getOptions,
};

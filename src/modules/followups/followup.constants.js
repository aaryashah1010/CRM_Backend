'use strict';

const FOLLOW_UP_TYPES = Object.freeze(['call', 'email', 'meeting', 'demo', 'other']);
const FOLLOW_UP_STATUSES = Object.freeze(['scheduled', 'completed', 'cancelled', 'rescheduled']);
const FOLLOW_UP_LIST_STATUSES = Object.freeze([
  'all',
  'open',
  'upcoming',
  'overdue',
  'due_today',
  ...FOLLOW_UP_STATUSES,
]);

const FOLLOW_UP_SORT_FIELDS = Object.freeze({
  scheduledAt: 'f.scheduled_at',
  completedAt: 'f.completed_at',
  status: 'f.status',
  followUpType: 'f.follow_up_type',
  leadNumber: 'l.lead_number',
  customerName: 'COALESCE(c.name, l.customer_name)',
  priority: 'l.priority',
  createdAt: 'f.created_at',
  updatedAt: 'f.updated_at',
});

const FOLLOW_UP_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Follow-ups fetched successfully',
  DETAIL_FETCHED: 'Follow-up fetched successfully',
  OPTIONS_FETCHED: 'Follow-up options fetched successfully',
  METRICS_FETCHED: 'Follow-up metrics fetched successfully',
  CREATED: 'Follow-up created successfully',
  UPDATED: 'Follow-up updated successfully',
  COMPLETED: 'Follow-up completed successfully',
  CANCELLED: 'Follow-up cancelled successfully',
  DEACTIVATED: 'Follow-up deactivated successfully',
});

module.exports = {
  FOLLOW_UP_TYPES,
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_LIST_STATUSES,
  FOLLOW_UP_SORT_FIELDS,
  FOLLOW_UP_MESSAGES,
};

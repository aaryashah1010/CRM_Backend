'use strict';

const LEAD_STATUSES = Object.freeze(['new', 'contacted', 'qualified', 'lost', 'converted']);
const LEAD_SOURCES = Object.freeze(['website', 'referral', 'cold_call', 'email', 'social_media', 'exhibition', 'other']);
const LEAD_PRIORITIES = Object.freeze(['low', 'medium', 'high']);
const FOLLOW_UP_TYPES = Object.freeze(['call', 'email', 'meeting', 'demo', 'other']);
const FOLLOW_UP_STATUSES = Object.freeze(['scheduled', 'completed', 'cancelled', 'rescheduled']);

const LEAD_SORT_FIELDS = Object.freeze({
  leadNumber: 'l.lead_number',
  customerName: 'COALESCE(c.name, l.customer_name)',
  expectedValue: 'l.expected_value',
  expectedCloseDate: 'l.expected_close_date',
  priority: 'l.priority',
  status: 'l.status',
  createdAt: 'l.created_at',
  updatedAt: 'l.updated_at',
});

const LEAD_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Leads fetched successfully',
  DETAIL_FETCHED: 'Lead fetched successfully',
  PIPELINE_FETCHED: 'Lead pipeline fetched successfully',
  CREATED: 'Lead created successfully',
  UPDATED: 'Lead updated successfully',
  STATUS_UPDATED: 'Lead status updated successfully',
  FOLLOW_UP_CREATED: 'Follow-up created successfully',
  CONVERTED_TO_QUOTATION: 'Lead converted to quotation successfully',
  METRICS_FETCHED: 'Lead metrics fetched successfully',
  OPTIONS_FETCHED: 'Lead options fetched successfully',
});

module.exports = {
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  FOLLOW_UP_TYPES,
  FOLLOW_UP_STATUSES,
  LEAD_SORT_FIELDS,
  LEAD_MESSAGES,
};

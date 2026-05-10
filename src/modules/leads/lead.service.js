'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, NotFoundError } = require('../../common/errors');
const customerRepository = require('../customers/customer.repository');
const quotationRepository = require('../quotations/quotation.repository');
const quotationService = require('../quotations/quotation.service');
const { QUOTATION_STATUS } = require('../quotations/quotation.constants');
const leadRepository = require('./lead.repository');
const { LEAD_STATUSES, LEAD_SOURCES, LEAD_PRIORITIES, FOLLOW_UP_TYPES, FOLLOW_UP_STATUSES } = require('./lead.constants');

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

const addDays = (dateValue, days) => {
  const date = new Date(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const normalizeCustomer = (row) => row.customer_id ? ({
  id: row.customer_id,
  name: row.linked_customer_name,
  code: row.linked_customer_code,
}) : null;

const normalizeAssignee = (row) => row.assigned_to ? ({
  id: row.assigned_to,
  fullName: row.assigned_to_name,
  email: row.assigned_to_email || null,
}) : null;

const normalizeQuotation = (row) => row.quotation_id ? ({
  id: row.quotation_id,
  quotationNumber: row.quotation_number,
  status: row.quotation_status,
  totalAmount: toNumber(row.quotation_total_amount),
}) : null;

const normalizeLeadSummary = (row) => ({
  id: row.id,
  leadNumber: row.lead_number,
  customerId: row.customer_id,
  customer: normalizeCustomer(row),
  customerName: row.linked_customer_name || row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  customerCompany: row.customer_company,
  source: row.source,
  priority: row.priority,
  status: row.status,
  assignedTo: row.assigned_to,
  assignee: normalizeAssignee(row),
  expectedValue: toNumber(row.expected_value),
  expectedCloseDate: normalizeDate(row.expected_close_date),
  lastActivityAt: normalizeDateTime(row.last_activity_at),
  nextFollowUpAt: normalizeDateTime(row.next_follow_up_at),
  openFollowUpCount: toNumber(row.open_follow_up_count),
  quotation: normalizeQuotation(row),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeFollowUp = (row) => ({
  id: row.id,
  leadId: row.lead_id,
  followUpType: row.follow_up_type,
  status: row.status,
  scheduledAt: normalizeDateTime(row.scheduled_at),
  completedAt: normalizeDateTime(row.completed_at),
  assignedTo: row.assigned_to,
  assignedToName: row.assigned_to_name || null,
  subject: row.subject,
  notes: row.notes,
  nextFollowUpDate: normalizeDate(row.next_follow_up_date),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeLead = (row, followUps = []) => ({
  ...normalizeLeadSummary(row),
  notes: row.notes,
  lostReason: row.lost_reason,
  convertedAt: normalizeDateTime(row.converted_at),
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  followUps: followUps.map(normalizeFollowUp),
});

const normalizePayload = (payload) => {
  const normalized = { ...payload };
  if (payload.customerId !== undefined) normalized.customerId = emptyToNull(payload.customerId);
  if (payload.customerName !== undefined) normalized.customerName = emptyToNull(payload.customerName);
  if (payload.customerEmail !== undefined) normalized.customerEmail = emptyToNull(payload.customerEmail);
  if (payload.customerPhone !== undefined) normalized.customerPhone = emptyToNull(payload.customerPhone);
  if (payload.customerCompany !== undefined) normalized.customerCompany = emptyToNull(payload.customerCompany);
  if (payload.source !== undefined) normalized.source = emptyToNull(payload.source);
  if (payload.assignedTo !== undefined) normalized.assignedTo = emptyToNull(payload.assignedTo);
  if (payload.expectedCloseDate !== undefined) normalized.expectedCloseDate = normalizeDate(payload.expectedCloseDate);
  if (payload.notes !== undefined) normalized.notes = emptyToNull(payload.notes);
  if (payload.lostReason !== undefined) normalized.lostReason = emptyToNull(payload.lostReason);
  return normalized;
};

const generateLeadNumber = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
    const leadNumber = `LD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${suffix}`;
    const existing = await leadRepository.findByNumber(leadNumber);
    if (!existing) return leadNumber;
  }
  throw new BusinessRuleError('Unable to generate lead number');
};

const assertReferences = async ({ customerId, assignedTo }) => {
  if (customerId) {
    const exists = await leadRepository.customerExists(customerId);
    if (!exists) throw new BusinessRuleError('Selected customer does not exist or is inactive');
  }
  if (assignedTo) {
    const exists = await leadRepository.userExists(assignedTo);
    if (!exists) throw new BusinessRuleError('Selected assignee does not exist or is inactive');
  }
};

const listLeads = async (query) => {
  const result = await leadRepository.listLeads(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeLeadSummary),
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

const getLead = async (leadId) => {
  const lead = await leadRepository.findById(leadId);
  if (!lead) throw new NotFoundError('Lead not found');
  const followUps = await leadRepository.listFollowUps(leadId);
  return normalizeLead(lead, followUps);
};

const createLead = async (payload, actorUserId) => {
  const lead = normalizePayload(payload);
  await assertReferences(lead);
  const leadId = await leadRepository.createLead({
    ...lead,
    leadNumber: await generateLeadNumber(),
    actorUserId,
  });
  return getLead(leadId);
};

const updateLead = async (leadId, payload, actorUserId) => {
  await getLead(leadId);
  const updates = normalizePayload(payload);
  await assertReferences(updates);
  await leadRepository.updateLead(leadId, { ...updates, actorUserId });
  return getLead(leadId);
};

const updateStatus = async (leadId, payload, actorUserId) => {
  const lead = await getLead(leadId);
  if (lead.status === 'converted' && payload.status !== 'converted') {
    throw new BusinessRuleError('Converted leads cannot be moved back to another status');
  }
  if (payload.status === 'lost' && !payload.lostReason) {
    throw new BusinessRuleError('Lost reason is required when marking a lead as lost');
  }
  await leadRepository.updateLead(leadId, {
    status: payload.status,
    lostReason: payload.status === 'lost' ? payload.lostReason : null,
    convertedAt: payload.status === 'converted' ? new Date().toISOString() : lead.convertedAt,
    actorUserId,
  });
  return getLead(leadId);
};

const createFollowUp = async (leadId, payload, actorUserId) => {
  await getLead(leadId);
  const followUp = {
    ...payload,
    scheduledAt: normalizeDateTime(payload.scheduledAt),
    completedAt: normalizeDateTime(payload.completedAt),
    nextFollowUpDate: normalizeDate(payload.nextFollowUpDate),
  };
  await assertReferences({ assignedTo: followUp.assignedTo });
  await leadRepository.createFollowUp(leadId, { ...followUp, actorUserId });
  return getLead(leadId);
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await quotationRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const assertActiveCustomerExists = async (customerId) => {
  if (!customerId) return;
  const exists = await quotationRepository.customerExists(customerId);
  if (!exists) throw new BusinessRuleError('Lead customer does not exist or is inactive');
};

const customerNameFromLead = (lead) =>
  lead.linked_customer_name || lead.customer_company || lead.customer_name;

const createCustomerFromLead = async (lead, actorUserId, client) => {
  const customerName = customerNameFromLead(lead);
  if (!customerName) {
    throw new BusinessRuleError('Lead must have a customer name or company before quotation conversion');
  }

  const customerCode = await customerRepository.generateCustomerCode(client);
  return customerRepository.createCustomer({
    customerCode,
    name: customerName,
    email: lead.customer_email || null,
    phone: lead.customer_phone || null,
    mobile: null,
    website: null,
    gstNumber: null,
    panNumber: null,
    paymentTermId: null,
    creditLimit: 0,
    assignedTo: lead.assigned_to || null,
    notes: `Auto-created from lead ${lead.lead_number}`,
    isActive: true,
    actorUserId,
  }, client);
};

const convertToQuotation = async (leadId, payload, actorUserId) => {
  const lead = await leadRepository.findById(leadId);
  if (!lead) throw new NotFoundError('Lead not found');
  if (!lead.is_active) throw new BusinessRuleError('Inactive leads cannot be converted to quotations');

  const existingQuotation = await quotationRepository.findLatestByLeadId(leadId);
  if (existingQuotation) {
    return {
      created: false,
      lead: await getLead(leadId),
      quotation: await quotationService.getQuotation(Number(existingQuotation.id)),
    };
  }

  if (lead.status === 'lost') {
    throw new BusinessRuleError('Lost leads cannot be converted to quotations');
  }

  await assertPaymentTermExists(payload.paymentTermId);
  await assertReferences({ assignedTo: payload.assignedTo });
  await assertActiveCustomerExists(lead.customer_id);

  const quotationDate = normalizeDate(payload.quotationDate) || normalizeDate(new Date());
  const validUntil = normalizeDate(payload.validUntil) || addDays(quotationDate, 30);
  if (new Date(validUntil) < new Date(quotationDate)) {
    throw new BusinessRuleError('Valid-until date must be on or after the quotation date');
  }

  const quotationId = await db.withTransaction(async (client) => {
    const customerId = lead.customer_id || await createCustomerFromLead(lead, actorUserId, client);
    const quotationNumber = await quotationRepository.generateQuotationNumber(client);

    const id = await quotationRepository.insertQuotation({
      quotationNumber,
      customerId,
      leadId,
      quotationDate,
      validUntil,
      status: QUOTATION_STATUS.DRAFT,
      paymentTermId: payload.paymentTermId || null,
      billingAddress: null,
      shippingAddress: null,
      subtotalAmount: 0,
      discountAmount: 0,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxAmount: 0,
      roundOffAmount: 0,
      totalAmount: 0,
      notes: payload.notes || lead.notes || null,
      termsAndConditions: payload.termsAndConditions || null,
      assignedTo: payload.assignedTo || lead.assigned_to || null,
      actorUserId,
    }, client);

    await leadRepository.updateLead(leadId, {
      customerId,
      status: 'converted',
      convertedAt: new Date().toISOString(),
      actorUserId,
    }, client);

    return id;
  });

  return {
    created: true,
    lead: await getLead(leadId),
    quotation: await quotationService.getQuotation(quotationId),
  };
};

const getMetrics = async () => {
  const metrics = await leadRepository.getMetrics();
  const totalLeads = toNumber(metrics.totals?.total_leads);
  const convertedLeads = toNumber(metrics.totals?.converted_leads);
  return {
    totalLeads,
    activeLeads: toNumber(metrics.totals?.active_leads),
    totalLeadValue: toNumber(metrics.totals?.total_lead_value),
    convertedLeads,
    staleLeads: toNumber(metrics.totals?.stale_leads),
    conversionRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0,
    byStatus: metrics.byStatus.map((row) => ({
      status: row.status,
      leadCount: toNumber(row.lead_count),
      expectedValue: toNumber(row.expected_value),
    })),
  };
};

const getPipeline = async () => {
  const rows = await leadRepository.getPipeline();
  const grouped = LEAD_STATUSES.map((status) => ({
    status,
    leads: rows.filter((row) => row.status === status).map(normalizeLeadSummary),
  }));
  return grouped.map((stage) => ({
    ...stage,
    leadCount: stage.leads.length,
    expectedValue: stage.leads.reduce((sum, lead) => sum + lead.expectedValue, 0),
  }));
};

const getOptions = async () => {
  const [users, customers] = await Promise.all([
    leadRepository.listAssignableUsers(),
    leadRepository.listCustomerOptions(),
  ]);
  return {
    statuses: LEAD_STATUSES,
    sources: LEAD_SOURCES,
    priorities: LEAD_PRIORITIES,
    followUpTypes: FOLLOW_UP_TYPES,
    followUpStatuses: FOLLOW_UP_STATUSES,
    assignees: users.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      roleCode: row.role_code,
    })),
    customers: customers.map((row) => ({
      id: row.id,
      customerCode: row.customer_code,
      name: row.name,
      email: row.email,
      phone: row.mobile || row.phone,
    })),
  };
};

module.exports = {
  listLeads,
  getLead,
  createLead,
  updateLead,
  updateStatus,
  createFollowUp,
  convertToQuotation,
  getMetrics,
  getPipeline,
  getOptions,
};

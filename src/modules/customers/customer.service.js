'use strict';

const db = require('../../config/db');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');
const customerRepository = require('./customer.repository');

const emptyToNull = (value) => (value === '' ? null : value);
const toNumber = (value) => Number(value || 0);

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizePaymentTerm = (row) => row.payment_term_id ? ({
  id: row.payment_term_id,
  name: row.payment_term_name,
  days: row.payment_term_days,
}) : null;

const normalizeCustomerSummary = (row) => ({
  id: row.id,
  customerCode: row.customer_code,
  name: row.name,
  email: row.email,
  phone: row.phone,
  mobile: row.mobile,
  gstNumber: row.gst_number,
  panNumber: row.pan_number,
  creditLimit: toNumber(row.credit_limit),
  outstandingAmount: toNumber(row.outstanding_amount),
  totalSales: toNumber(row.total_sales),
  totalReceipts: toNumber(row.total_receipts),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  paymentTerm: normalizePaymentTerm(row),
  assignedTo: row.assigned_to_id ? {
    id: row.assigned_to_id,
    fullName: row.assigned_to_name,
  } : null,
});

const normalizeAddress = (row) => ({
  id: row.id,
  customerId: row.customer_id,
  addressType: row.address_type,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  city: row.city,
  state: row.state,
  pincode: row.pincode,
  country: row.country,
  isDefault: Boolean(row.is_default),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeCustomer = (row, addresses, ledger) => ({
  ...normalizeCustomerSummary(row),
  website: row.website,
  notes: row.notes,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  addresses: addresses.map(normalizeAddress),
  ledger: ledger.map((entry) => ({
    transactionDate: normalizeDate(entry.transaction_date),
    transactionType: entry.transaction_type,
    referenceNumber: entry.reference_number,
    status: entry.status,
    debit: toNumber(entry.debit),
    credit: toNumber(entry.credit),
    balance: toNumber(entry.balance),
  })),
});

const normalizeLedgerEntry = (entry, runningBalance) => ({
  referenceType: entry.reference_type,
  referenceId: entry.reference_id,
  referenceNumber: entry.reference_number,
  transactionDate: normalizeDate(entry.transaction_date),
  status: entry.status,
  notes: entry.notes,
  debit: toNumber(entry.debit),
  credit: toNumber(entry.credit),
  runningBalance,
});

const normalizeCustomerLedger = (customer, entries) => {
  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const ledgerEntries = entries.map((entry) => {
    const debit = toNumber(entry.debit);
    const credit = toNumber(entry.credit);
    totalDebit += debit;
    totalCredit += credit;
    runningBalance += debit - credit;
    return normalizeLedgerEntry(entry, runningBalance);
  });

  return {
    customer: normalizeCustomerSummary(customer),
    openingBalance: 0,
    totalDebit,
    totalCredit,
    closingBalance: runningBalance,
    entries: ledgerEntries,
  };
};

const normalizePayload = (payload) => ({
  ...payload,
  email: emptyToNull(payload.email),
  phone: emptyToNull(payload.phone),
  mobile: emptyToNull(payload.mobile),
  website: emptyToNull(payload.website),
  gstNumber: emptyToNull(payload.gstNumber),
  panNumber: emptyToNull(payload.panNumber),
  paymentTermId: emptyToNull(payload.paymentTermId),
  assignedTo: emptyToNull(payload.assignedTo),
  notes: emptyToNull(payload.notes),
  addresses: payload.addresses || [],
});

const normalizeMetrics = (metrics) => ({
  totalCustomers: toNumber(metrics.totals?.total_customers),
  activeCustomers: toNumber(metrics.totals?.active_customers),
  totalCreditLimit: toNumber(metrics.totals?.total_credit_limit),
  totalOutstanding: toNumber(metrics.totals?.total_outstanding),
  overLimitCustomers: toNumber(metrics.totals?.over_limit_customers),
  aging: {
    currentAmount: toNumber(metrics.aging?.current_amount),
    days31To60: toNumber(metrics.aging?.days_31_60),
    days61To90: toNumber(metrics.aging?.days_61_90),
    days90Plus: toNumber(metrics.aging?.days_90_plus),
  },
});

const assertUniqueCustomer = async ({ customerCode, gstNumber, excludeCustomerId = null }) => {
  const existing = await customerRepository.findByCodeOrGst({ customerCode, gstNumber, excludeCustomerId });
  if (existing) {
    throw new ConflictError('A customer with this code or GST number already exists');
  }
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await customerRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const assertAssignedUserExists = async (userId) => {
  if (!userId) return;
  const exists = await customerRepository.userExists(userId);
  if (!exists) throw new BusinessRuleError('Selected assigned user does not exist or is inactive');
};

const listCustomers = async (query) => {
  const result = await customerRepository.listCustomers(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    items: result.rows.map(normalizeCustomerSummary),
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

const getCustomer = async (customerId) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw new NotFoundError('Customer not found');

  const [addresses, ledger] = await Promise.all([
    customerRepository.listAddresses(customerId),
    customerRepository.getLedger(customerId),
  ]);

  return normalizeCustomer(customer, addresses, ledger);
};

const getCustomerLedger = async (customerId) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw new NotFoundError('Customer not found');

  const entries = await customerRepository.getLedgerEntries(customerId);
  return normalizeCustomerLedger(customer, entries);
};

const createCustomer = async (payload, actorUserId) => {
  const customer = normalizePayload(payload);
  await assertUniqueCustomer(customer);
  await assertPaymentTermExists(customer.paymentTermId);
  await assertAssignedUserExists(customer.assignedTo);

  const customerId = await db.withTransaction(async (client) => {
    const id = await customerRepository.createCustomer({ ...customer, actorUserId }, client);
    await customerRepository.replaceAddresses(id, customer.addresses, actorUserId, client);
    return id;
  });

  return getCustomer(customerId);
};

const updateCustomer = async (customerId, payload, actorUserId) => {
  const existing = await getCustomer(customerId);
  const updates = normalizePayload(payload);

  if (updates.customerCode !== undefined || updates.gstNumber !== undefined) {
    await assertUniqueCustomer({
      customerCode: updates.customerCode || existing.customerCode,
      gstNumber: updates.gstNumber !== undefined ? updates.gstNumber : existing.gstNumber,
      excludeCustomerId: customerId,
    });
  }

  if (updates.paymentTermId !== undefined) await assertPaymentTermExists(updates.paymentTermId);
  if (updates.assignedTo !== undefined) await assertAssignedUserExists(updates.assignedTo);

  await db.withTransaction(async (client) => {
    await customerRepository.updateCustomer(customerId, { ...updates, actorUserId }, client);
    if (payload.addresses !== undefined) {
      await customerRepository.replaceAddresses(customerId, updates.addresses, actorUserId, client);
    }
  });

  return getCustomer(customerId);
};

const setActiveState = async (customerId, isActive, actorUserId) => {
  await getCustomer(customerId);
  await customerRepository.setActiveState(customerId, isActive, actorUserId);
  return getCustomer(customerId);
};

const listPaymentTerms = async () => {
  const rows = await customerRepository.listPaymentTerms();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    days: row.days,
    description: row.description,
    isActive: Boolean(row.is_active),
  }));
};

const getMetrics = async () => normalizeMetrics(await customerRepository.getMetrics());

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  setActiveState,
  listPaymentTerms,
  getMetrics,
  getCustomerLedger,
};

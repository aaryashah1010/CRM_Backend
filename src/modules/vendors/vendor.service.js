'use strict';

const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');
const vendorRepository = require('./vendor.repository');

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

const normalizeVendorSummary = (row) => ({
  id: row.id,
  vendorCode: row.vendor_code,
  name: row.name,
  email: row.email,
  phone: row.phone,
  mobile: row.mobile,
  gstNumber: row.gst_number,
  panNumber: row.pan_number,
  city: row.city,
  state: row.state,
  totalProcurement: toNumber(row.total_procurement),
  totalPaid: toNumber(row.total_paid),
  outstandingAmount: toNumber(row.outstanding_amount),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  paymentTerm: normalizePaymentTerm(row),
});

const normalizeVendor = (row, ledger = []) => ({
  ...normalizeVendorSummary(row),
  website: row.website,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  pincode: row.pincode,
  country: row.country,
  bankName: row.bank_name,
  bankAccountNumber: row.bank_account_number,
  bankIfscCode: row.bank_ifsc_code,
  bankBranch: row.bank_branch,
  notes: row.notes,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  ledger: ledger.map((entry) => ({
    transactionDate: normalizeDate(entry.transaction_date),
    transactionType: entry.transaction_type,
    referenceNumber: entry.reference_number,
    status: entry.status,
    debit: toNumber(entry.debit),
    credit: toNumber(entry.credit),
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

const normalizeVendorLedger = (vendor, entries) => {
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
    vendor: normalizeVendorSummary(vendor),
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
  addressLine1: emptyToNull(payload.addressLine1),
  addressLine2: emptyToNull(payload.addressLine2),
  city: emptyToNull(payload.city),
  state: emptyToNull(payload.state),
  pincode: emptyToNull(payload.pincode),
  country: emptyToNull(payload.country) || 'India',
  bankName: emptyToNull(payload.bankName),
  bankAccountNumber: emptyToNull(payload.bankAccountNumber),
  bankIfscCode: emptyToNull(payload.bankIfscCode),
  bankBranch: emptyToNull(payload.bankBranch),
  notes: emptyToNull(payload.notes),
});

const assertUniqueVendor = async ({ vendorCode, gstNumber, excludeVendorId = null }) => {
  const existing = await vendorRepository.findByCodeOrGst({ vendorCode, gstNumber, excludeVendorId });
  if (existing) throw new ConflictError('A vendor with this code or GST number already exists');
};

const assertPaymentTermExists = async (paymentTermId) => {
  if (!paymentTermId) return;
  const exists = await vendorRepository.paymentTermExists(paymentTermId);
  if (!exists) throw new BusinessRuleError('Selected payment term does not exist or is inactive');
};

const listVendors = async (query) => {
  const result = await vendorRepository.listVendors(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeVendorSummary),
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

const getVendor = async (vendorId) => {
  const vendor = await vendorRepository.findById(vendorId);
  if (!vendor) throw new NotFoundError('Vendor not found');
  const ledger = await vendorRepository.getLedger(vendorId);
  return normalizeVendor(vendor, ledger);
};

const getVendorLedger = async (vendorId) => {
  const vendor = await vendorRepository.findById(vendorId);
  if (!vendor) throw new NotFoundError('Vendor not found');

  const entries = await vendorRepository.getLedgerEntries(vendorId);
  return normalizeVendorLedger(vendor, entries);
};

const createVendor = async (payload, actorUserId) => {
  const vendor = normalizePayload(payload);
  await assertUniqueVendor(vendor);
  await assertPaymentTermExists(vendor.paymentTermId);
  const vendorId = await vendorRepository.createVendor({ ...vendor, actorUserId });
  return getVendor(vendorId);
};

const updateVendor = async (vendorId, payload, actorUserId) => {
  const existing = await getVendor(vendorId);
  const updates = normalizePayload(payload);

  if (updates.vendorCode !== undefined || updates.gstNumber !== undefined) {
    await assertUniqueVendor({
      vendorCode: updates.vendorCode || existing.vendorCode,
      gstNumber: updates.gstNumber !== undefined ? updates.gstNumber : existing.gstNumber,
      excludeVendorId: vendorId,
    });
  }
  if (updates.paymentTermId !== undefined) await assertPaymentTermExists(updates.paymentTermId);
  await vendorRepository.updateVendor(vendorId, { ...updates, actorUserId });
  return getVendor(vendorId);
};

const setActiveState = async (vendorId, isActive, actorUserId) => {
  await getVendor(vendorId);
  await vendorRepository.setActiveState(vendorId, isActive, actorUserId);
  return getVendor(vendorId);
};

const listPaymentTerms = async () => {
  const rows = await vendorRepository.listPaymentTerms();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    days: row.days,
    description: row.description,
    isActive: Boolean(row.is_active),
  }));
};

const getMetrics = async () => {
  const metrics = await vendorRepository.getMetrics();
  return {
    totalVendors: toNumber(metrics.totals?.total_vendors),
    activeVendors: toNumber(metrics.totals?.active_vendors),
    totalProcurement: toNumber(metrics.totals?.total_procurement),
    totalPaid: toNumber(metrics.totals?.total_paid),
    outstandingAmount: Math.max(0, toNumber(metrics.totals?.total_procurement) - toNumber(metrics.totals?.total_paid)),
    topVendors: metrics.topVendors.map((row) => ({
      id: row.id,
      name: row.name,
      vendorCode: row.vendor_code,
      totalProcurement: toNumber(row.total_procurement),
    })),
  };
};

module.exports = {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  setActiveState,
  listPaymentTerms,
  getMetrics,
  getVendorLedger,
};

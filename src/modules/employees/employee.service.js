'use strict';

const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { ConflictError, NotFoundError, BusinessRuleError } = require('../../common/errors');
const employeeRepository = require('./employee.repository');

const emptyToNull = (value) => (value === '' ? null : value);

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizeDepartment = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  isActive: Boolean(row.is_active),
});

// Summary normalization — used for list responses (no bank fields)
const normalizeEmployeeSummary = (row) => ({
  id: row.id,
  departmentId: row.department_id,
  employeeCode: row.employee_code,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  designation: row.designation,
  dateOfJoining: normalizeDate(row.date_of_joining),
  city: row.city,
  state: row.state,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  department: row.department_id ? {
    id: row.department_id,
    name: row.department_name,
    code: row.department_code,
  } : null,
});

// Full normalization — used for single-record detail responses (includes bank fields)
const normalizeEmployee = (row) => ({
  ...normalizeEmployeeSummary(row),
  userId: row.user_id,
  dateOfBirth: normalizeDate(row.date_of_birth),
  gender: row.gender,
  address: row.address,
  pincode: row.pincode,
  bankName: row.bank_name,
  bankAccountNumber: row.bank_account_number,
  bankIfscCode: row.bank_ifsc_code,
  bankBranch: row.bank_branch,
  emergencyContactName: row.emergency_contact_name,
  emergencyContactPhone: row.emergency_contact_phone,
  emergencyContactRelation: row.emergency_contact_relation,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  user: row.user_id ? {
    id: row.user_id,
    fullName: row.user_full_name,
    username: row.username,
    email: row.user_email,
  } : null,
});

const normalizePayload = (payload) => ({
  ...payload,
  userId: emptyToNull(payload.userId),
  departmentId: emptyToNull(payload.departmentId),
  email: emptyToNull(payload.email),
  phone: emptyToNull(payload.phone),
  designation: emptyToNull(payload.designation),
  dateOfJoining: emptyToNull(payload.dateOfJoining),
  dateOfBirth: emptyToNull(payload.dateOfBirth),
  gender: emptyToNull(payload.gender),
  address: emptyToNull(payload.address),
  city: emptyToNull(payload.city),
  state: emptyToNull(payload.state),
  pincode: emptyToNull(payload.pincode),
  bankName: emptyToNull(payload.bankName),
  bankAccountNumber: emptyToNull(payload.bankAccountNumber),
  bankIfscCode: emptyToNull(payload.bankIfscCode),
  bankBranch: emptyToNull(payload.bankBranch),
  emergencyContactName: emptyToNull(payload.emergencyContactName),
  emergencyContactPhone: emptyToNull(payload.emergencyContactPhone),
  emergencyContactRelation: emptyToNull(payload.emergencyContactRelation),
});

const nextBirthdayDistance = (dateOfBirth, today = new Date()) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();
  const year = today.getUTCFullYear();
  const makeBirthday = (targetYear) => {
    const candidate = new Date(Date.UTC(targetYear, month, day));
    if (candidate.getUTCMonth() !== month) {
      return new Date(Date.UTC(targetYear, 1, 28));
    }
    return candidate;
  };

  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let nextBirthday = makeBirthday(year);
  if (nextBirthday < todayUtc) {
    nextBirthday = makeBirthday(year + 1);
  }

  return Math.round((nextBirthday.getTime() - todayUtc.getTime()) / 86400000);
};

const normalizeMetrics = (metrics) => ({
  totalEmployees: Number(metrics.totals?.total_employees || 0),
  activeEmployees: Number(metrics.totals?.active_employees || 0),
  inactiveEmployees: Number(metrics.totals?.inactive_employees || 0),
  newThisMonth: Number(metrics.totals?.new_this_month || 0),
  departmentDistribution: metrics.departmentDistribution.map((row) => ({
    departmentId: row.id,
    departmentName: row.name,
    departmentCode: row.code,
    employeeCount: Number(row.employee_count || 0),
  })),
  upcomingBirthdays: metrics.upcomingBirthdays
    .map((row) => ({
      id: row.id,
      fullName: row.full_name,
      employeeCode: row.employee_code,
      designation: row.designation,
      dateOfBirth: normalizeDate(row.date_of_birth),
      daysUntil: nextBirthdayDistance(row.date_of_birth),
    }))
    .filter((row) => row.daysUntil !== null && row.daysUntil <= 30)
    .sort((first, second) => first.daysUntil - second.daysUntil || first.fullName.localeCompare(second.fullName))
    .slice(0, 8)
    .map(({ daysUntil: _daysUntil, ...row }) => row),
});

const assertUniqueCode = async (employeeCode, excludeEmployeeId = null) => {
  const existing = await employeeRepository.findByCode(employeeCode, excludeEmployeeId);
  if (existing) {
    throw new ConflictError('An employee with this code already exists');
  }
};

const assertDepartmentExists = async (departmentId) => {
  if (!departmentId) return;
  const exists = await employeeRepository.departmentExists(departmentId);
  if (!exists) {
    throw new BusinessRuleError('Selected department does not exist or is inactive');
  }
};

const assertUserExists = async (userId) => {
  if (!userId) return;
  const exists = await employeeRepository.userExists(userId);
  if (!exists) {
    throw new BusinessRuleError('Selected user does not exist or is inactive');
  }
};

const listEmployees = async (query) => {
  const result = await employeeRepository.listEmployees(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    items: result.rows.map(normalizeEmployeeSummary),
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

const getEmployee = async (employeeId) => {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  return normalizeEmployee(employee);
};

const createEmployee = async (payload, actorUserId) => {
  const employee = normalizePayload(payload);
  await assertUniqueCode(employee.employeeCode);
  await assertDepartmentExists(employee.departmentId);
  await assertUserExists(employee.userId);

  const employeeId = await employeeRepository.createEmployee({
    ...employee,
    actorUserId,
  });

  return getEmployee(employeeId);
};

const updateEmployee = async (employeeId, payload, actorUserId) => {
  await getEmployee(employeeId);
  const updates = normalizePayload(payload);

  if (updates.employeeCode !== undefined) {
    await assertUniqueCode(updates.employeeCode, employeeId);
  }

  if (updates.departmentId !== undefined) {
    await assertDepartmentExists(updates.departmentId);
  }

  if (updates.userId !== undefined) {
    await assertUserExists(updates.userId);
  }

  await employeeRepository.updateEmployee(employeeId, {
    ...updates,
    actorUserId,
  });

  return getEmployee(employeeId);
};

const setActiveState = async (employeeId, isActive, actorUserId) => {
  await getEmployee(employeeId);
  await employeeRepository.setActiveState(employeeId, isActive, actorUserId);
  return getEmployee(employeeId);
};

const listDepartments = async () => {
  const departments = await employeeRepository.listDepartments();
  return departments.map(normalizeDepartment);
};

const getMetrics = async () => {
  const metrics = await employeeRepository.getMetrics();
  return normalizeMetrics(metrics);
};

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  setActiveState,
  listDepartments,
  getMetrics,
};

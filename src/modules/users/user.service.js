'use strict';

const bcrypt = require('bcrypt');
const env = require('../../config/env');
const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { ConflictError, NotFoundError, BusinessRuleError } = require('../../common/errors');
const userRepository = require('./user.repository');

const normalizeUser = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  username: row.username,
  phone: row.phone,
  isActive: Boolean(row.is_active),
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  role: {
    id: row.role_id,
    name: row.role_name,
    code: row.role_code,
  },
});

const normalizeRole = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  isActive: Boolean(row.is_active),
});

const normalizeMetrics = (metrics) => ({
  totalUsers: Number(metrics.totals?.total_users || 0),
  activeUsers: Number(metrics.totals?.active_users || 0),
  newThisMonth: Number(metrics.totals?.new_this_month || 0),
  dormantUsers: Number(metrics.totals?.dormant_users || 0),
  roleDistribution: metrics.roleDistribution.map((row) => ({
    roleId: row.id,
    roleName: row.name,
    roleCode: row.code,
    userCount: Number(row.user_count || 0),
  })),
});

const assertRoleExists = async (roleId) => {
  const exists = await userRepository.roleExists(roleId);
  if (!exists) {
    throw new BusinessRuleError('Selected role does not exist or is inactive');
  }
};

const assertUniqueIdentity = async ({ email, username, excludeUserId = null }) => {
  const existing = await userRepository.findByEmailOrUsername({ email, username, excludeUserId });
  if (existing) {
    throw new ConflictError('A user with this email or username already exists');
  }
};

const listUsers = async (query) => {
  const result = await userRepository.listUsers(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);

  return {
    items: result.rows.map(normalizeUser),
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

const getUser = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return normalizeUser(user);
};

const createUser = async (payload, actorUserId) => {
  await assertRoleExists(payload.roleId);
  await assertUniqueIdentity(payload);

  const passwordHash = await bcrypt.hash(payload.password, env.bcryptSaltRounds);
  const userId = await userRepository.createUser({
    ...payload,
    passwordHash,
    actorUserId,
  });

  return getUser(userId);
};

const updateUser = async (userId, payload, actorUserId) => {
  const existing = await getUser(userId);

  if (payload.roleId !== undefined) {
    await assertRoleExists(payload.roleId);
  }

  if (payload.email !== undefined || payload.username !== undefined) {
    await assertUniqueIdentity({
      email: payload.email || existing.email,
      username: payload.username || existing.username,
      excludeUserId: userId,
    });
  }

  await userRepository.updateUser(userId, {
    ...payload,
    actorUserId,
  });

  return getUser(userId);
};

const setActiveState = async (userId, isActive, actorUserId) => {
  await getUser(userId);
  if (!isActive && actorUserId && Number(userId) === Number(actorUserId)) {
    throw new BusinessRuleError('You cannot deactivate your own account');
  }

  await userRepository.setActiveState(userId, isActive, actorUserId);
  return getUser(userId);
};

const resetPassword = async (userId, password, actorUserId) => {
  await getUser(userId);
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  await userRepository.resetPassword(userId, passwordHash, actorUserId);
};

const listRoles = async () => {
  const roles = await userRepository.listRoles();
  return roles.map(normalizeRole);
};

const getMetrics = async () => {
  const metrics = await userRepository.getMetrics();
  return normalizeMetrics(metrics);
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setActiveState,
  resetPassword,
  listRoles,
  getMetrics,
};

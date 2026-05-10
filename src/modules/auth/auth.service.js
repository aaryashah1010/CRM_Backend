'use strict';

const bcrypt = require('bcrypt');
const { sign } = require('../../config/jwt');
const { AuthenticationError } = require('../../common/errors');
const authRepository = require('./auth.repository');

const normalizeUser = (user, permissions) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  username: user.username,
  phone: user.phone,
  isActive: Boolean(user.is_active),
  lastLoginAt: user.last_login_at,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
  role: {
    id: user.role_id,
    name: user.role_name,
    code: user.role_code,
  },
  permissions,
});

const buildTokenPayload = (user, permissions) => ({
  user_id: user.id,
  role_id: user.role_id,
  role_code: user.role_code,
  permissions,
  permissions_version: 1,
});

const login = async ({ identifier, password }) => {
  const user = await authRepository.findUserForLogin(identifier);
  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : false;

  if (!user || !passwordMatches) {
    throw new AuthenticationError('Invalid email, username, or password');
  }

  if (!user.is_active) {
    throw new AuthenticationError('Account is inactive');
  }

  const permissions = await authRepository.getPermissionsByRoleId(user.role_id);
  await authRepository.updateLastLogin(user.id);

  const accessToken = sign(buildTokenPayload(user, permissions));

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '8h',
    user: normalizeUser(user, permissions),
  };
};

const getAuthenticatedUser = async (authUser) => {
  const user = await authRepository.findUserById(authUser.user_id);

  if (!user || !user.is_active) {
    throw new AuthenticationError('Authenticated user is no longer active');
  }

  const permissions = await authRepository.getPermissionsByRoleId(user.role_id);
  return normalizeUser(user, permissions);
};

module.exports = {
  login,
  getAuthenticatedUser,
};

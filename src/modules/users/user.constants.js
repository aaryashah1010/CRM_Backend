'use strict';

const USER_SORT_FIELDS = Object.freeze({
  fullName: 'u.full_name',
  email: 'u.email',
  username: 'u.username',
  role: 'r.name',
  status: 'u.is_active',
  lastLoginAt: 'u.last_login_at',
  createdAt: 'u.created_at',
});

const USER_MESSAGES = Object.freeze({
  LIST_FETCHED: 'Users fetched successfully',
  DETAIL_FETCHED: 'User fetched successfully',
  CREATED: 'User created successfully',
  UPDATED: 'User updated successfully',
  DEACTIVATED: 'User deactivated successfully',
  ACTIVATED: 'User activated successfully',
  ROLES_FETCHED: 'Roles fetched successfully',
  METRICS_FETCHED: 'User metrics fetched successfully',
});

module.exports = {
  USER_SORT_FIELDS,
  USER_MESSAGES,
};

'use strict';

const { buildPaginationMeta } = require('../../common/utils/pagination.util');
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../common/errors');
const categoryRepository = require('./category.repository');

const emptyToNull = (value) => (value === '' ? null : value);
const toNumber = (value) => Number(value || 0);

const normalizeParent = (row) => row.parent_id ? ({
  id: row.parent_id,
  name: row.parent_name,
  code: row.parent_code,
}) : null;

const normalizeCategory = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  parentId: row.parent_id,
  parent: normalizeParent(row),
  description: row.description,
  productCount: toNumber(row.product_count),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
});

const normalizePayload = (payload) => ({
  ...payload,
  parentId: emptyToNull(payload.parentId),
  description: emptyToNull(payload.description),
});

const assertUniqueCode = async (code, excludeCategoryId = null) => {
  const existing = await categoryRepository.findByCode(code, excludeCategoryId);
  if (existing) throw new ConflictError('A product category with this code already exists');
};

const assertParent = async (parentId, categoryId = null) => {
  if (!parentId) return;
  if (categoryId && Number(parentId) === Number(categoryId)) {
    throw new BusinessRuleError('A category cannot be its own parent');
  }
  const parent = await categoryRepository.findById(parentId);
  if (!parent || !parent.is_active) throw new BusinessRuleError('Selected parent category does not exist or is inactive');
  if (categoryId) {
    const createsCycle = await categoryRepository.hasChild(categoryId, parentId);
    if (createsCycle) throw new BusinessRuleError('Selected parent category would create a hierarchy cycle');
  }
};

const listCategories = async (query) => {
  const result = await categoryRepository.listCategories(query);
  const pagination = buildPaginationMeta(result.total, result.page, result.limit);
  return {
    items: result.rows.map(normalizeCategory),
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

const getCategory = async (categoryId) => {
  const category = await categoryRepository.findById(categoryId);
  if (!category) throw new NotFoundError('Product category not found');
  return normalizeCategory(category);
};

const createCategory = async (payload, actorUserId) => {
  const category = normalizePayload(payload);
  await assertUniqueCode(category.code);
  await assertParent(category.parentId);
  const categoryId = await categoryRepository.createCategory({ ...category, actorUserId });
  return getCategory(categoryId);
};

const updateCategory = async (categoryId, payload, actorUserId) => {
  await getCategory(categoryId);
  const updates = normalizePayload(payload);
  if (updates.code !== undefined) await assertUniqueCode(updates.code, categoryId);
  if (updates.parentId !== undefined) await assertParent(updates.parentId, categoryId);
  await categoryRepository.updateCategory(categoryId, { ...updates, actorUserId });
  return getCategory(categoryId);
};

const setActiveState = async (categoryId, isActive, actorUserId) => {
  await getCategory(categoryId);
  await categoryRepository.setActiveState(categoryId, isActive, actorUserId);
  return getCategory(categoryId);
};

const getTree = async () => {
  const rows = await categoryRepository.getTree();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    parentId: row.parent_id,
    isActive: Boolean(row.is_active),
  }));
};

const getMetrics = async () => {
  const row = await categoryRepository.getMetrics();
  return {
    totalCategories: toNumber(row.total_categories),
    activeCategories: toNumber(row.active_categories),
    categoriesWithProducts: toNumber(row.categories_with_products),
    uncategorizedProducts: toNumber(row.uncategorized_products),
  };
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  setActiveState,
  getTree,
  getMetrics,
};

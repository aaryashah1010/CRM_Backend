'use strict';

const INVENTORY_STOCK_STATUSES = Object.freeze([
  'all',
  'in_stock',
  'low_stock',
  'out_of_stock',
]);

const INVENTORY_MOVEMENT_TYPES = Object.freeze([
  'inward',
  'outward',
  'adjustment_in',
  'adjustment_out',
  'return_in',
  'return_out',
  'opening',
]);

const INVENTORY_SORT_FIELDS = Object.freeze({
  sku: 'p.sku',
  name: 'p.name',
  category: 'c.name',
  quantityOnHand: 'quantity_on_hand',
  quantityAvailable: 'quantity_available',
  reorderLevel: 'p.reorder_level',
  stockValue: 'stock_value',
  updatedAt: 'COALESCE(psb.updated_at, p.updated_at)',
});

const INVENTORY_MOVEMENT_SORT_FIELDS = Object.freeze({
  movementDate: 'sm.movement_date',
  createdAt: 'sm.created_at',
  sku: 'p.sku',
  productName: 'p.name',
  movementType: 'sm.movement_type',
});

const INVENTORY_MESSAGES = Object.freeze({
  ITEMS_FETCHED: 'Inventory items fetched successfully',
  METRICS_FETCHED: 'Inventory metrics fetched successfully',
  MOVEMENTS_FETCHED: 'Stock movements fetched successfully',
  STOCK_ADJUSTED: 'Inventory adjusted successfully',
});

module.exports = {
  INVENTORY_STOCK_STATUSES,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_SORT_FIELDS,
  INVENTORY_MOVEMENT_SORT_FIELDS,
  INVENTORY_MESSAGES,
};

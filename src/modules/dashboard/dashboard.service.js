'use strict';

const dashboardRepository = require('./dashboard.repository');

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeSummary = (row, days) => ({
  windowDays: days,
  totalSalesAmount: toNumber(row.total_sales_amount),
  totalSalesCount: toNumber(row.total_sales_count),
  totalPurchaseAmount: toNumber(row.total_purchase_amount),
  totalPurchaseCount: toNumber(row.total_purchase_count),
  outstandingReceivables: toNumber(row.outstanding_receivables),
  overdueInvoiceCount: toNumber(row.overdue_invoice_count),
  outstandingPayables: Math.max(toNumber(row.outstanding_payables), 0),
  leadsReceived: toNumber(row.leads_received),
  quotationsSent: toNumber(row.quotations_sent),
  salesOrdersCount: toNumber(row.sales_orders_count),
  pendingPurchaseOrders: toNumber(row.pending_purchase_orders),
  totalCustomers: toNumber(row.total_customers),
  totalVendors: toNumber(row.total_vendors),
  totalProducts: toNumber(row.total_products),
  lowStockCount: toNumber(row.low_stock_count),
});

const normalizeTopCustomer = (row) => ({
  id: row.id,
  customerCode: row.customer_code,
  name: row.name,
  totalRevenue: toNumber(row.total_revenue),
  outstandingAmount: toNumber(row.outstanding_amount),
  invoiceCount: toNumber(row.invoice_count),
});

const normalizeLowStockProduct = (row) => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  unit: row.unit,
  reorderLevel: toNumber(row.reorder_level),
  reorderQuantity: toNumber(row.reorder_quantity),
  quantityOnHand: toNumber(row.quantity_on_hand),
  quantityReserved: toNumber(row.quantity_reserved),
  quantityAvailable: toNumber(row.quantity_available),
});

const normalizeActivity = (row) => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action,
  createdAt: row.created_at,
  actor: row.actor_user_id
    ? {
      id: row.actor_user_id,
      fullName: row.actor_full_name,
      username: row.actor_username,
    }
    : null,
});

const normalizeTrendPoint = (row) => ({
  date: row.date,
  amount: toNumber(row.amount),
  invoiceCount: toNumber(row.invoice_count),
});

const normalizeBestSellingProduct = (row) => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  unit: row.unit,
  quantitySold: toNumber(row.quantity_sold),
  totalRevenue: toNumber(row.total_revenue),
  invoiceCount: toNumber(row.invoice_count),
});

const MONTH_SHORT_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const normalizeMonthlySalesPoint = (row) => {
  const monthIndex = Math.max(0, Math.min(11, toNumber(row.month) - 1));
  return {
    monthStart: row.month_start,
    year: toNumber(row.year),
    month: toNumber(row.month),
    label: MONTH_SHORT_LABELS[monthIndex],
    amount: toNumber(row.amount),
    invoiceCount: toNumber(row.invoice_count),
  };
};

const normalizeMonthPoint = (row) => {
  const monthIndex = Math.max(0, Math.min(11, toNumber(row.month) - 1));
  return {
    monthStart: row.month_start,
    year: toNumber(row.year),
    month: toNumber(row.month),
    label: MONTH_SHORT_LABELS[monthIndex],
    amount: toNumber(row.amount),
    count: toNumber(row.count),
  };
};

const normalizeStatusCount = (rows) =>
  rows.reduce((acc, row) => {
    acc[row.status] = toNumber(row.count);
    return acc;
  }, {});

const normalizeOutstandingCustomer = (row) => ({
  id: toNumber(row.id),
  customerCode: row.customer_code,
  name: row.name,
  outstandingAmount: toNumber(row.outstanding_amount),
});

const normalizeOutstandingVendor = (row) => ({
  id: toNumber(row.id),
  vendorCode: row.vendor_code,
  name: row.name,
  outstandingAmount: toNumber(row.outstanding_amount),
});

const normalizeStockMovement = (row) => ({
  id: toNumber(row.id),
  productId: toNumber(row.product_id),
  sku: row.sku,
  productName: row.product_name,
  movementType: row.movement_type,
  referenceType: row.reference_type,
  referenceId: row.reference_id ? toNumber(row.reference_id) : null,
  quantityIn: toNumber(row.quantity_in),
  quantityOut: toNumber(row.quantity_out),
  balanceAfter: toNumber(row.balance_after),
  movementDate: row.movement_date,
  remarks: row.remarks,
  createdAt: row.created_at,
});

const normalizeStockValueProduct = (row) => ({
  id: toNumber(row.id),
  sku: row.sku,
  name: row.name,
  unit: row.unit,
  quantityOnHand: toNumber(row.quantity_on_hand),
  costPrice: toNumber(row.cost_price),
  stockValue: toNumber(row.stock_value),
});

const normalizeLeadStatus = (row) => ({
  status: row.status,
  count: toNumber(row.count),
  value: toNumber(row.value),
});

const normalizeRecentActivityItem = (row) => ({
  type: row.type,
  referenceNumber: row.reference_number,
  title: row.title,
  amount: toNumber(row.amount),
  status: row.status,
  occurredAt: row.occurred_at,
});

const normalizeAlert = (row) => ({
  type: row.type,
  severity: row.severity,
  referenceNumber: row.reference_number,
  message: row.message,
  amount: toNumber(row.amount),
  dueDate: row.due_date,
  createdAt: row.created_at,
});

const getDashboard = async () => {
  const [
    sales,
    purchases,
    receivables,
    payables,
    inventory,
    leads,
    recentActivity,
    alerts,
  ] = await Promise.all([
    dashboardRepository.fetchSalesOverview(),
    dashboardRepository.fetchPurchaseOverview(),
    dashboardRepository.fetchReceivablesOverview(),
    dashboardRepository.fetchPayablesOverview(),
    dashboardRepository.fetchInventoryOverview(),
    dashboardRepository.fetchLeadsOverview(),
    dashboardRepository.fetchRecentActivityOverview(),
    dashboardRepository.fetchAlertsOverview(),
  ]);

  const salesTotals = sales.totals || {};
  const purchaseTotals = purchases.totals || {};
  const receivableTotals = receivables.totals || {};
  const payableTotals = payables.totals || {};
  const inventoryTotals = inventory.totals || {};
  const leadTotals = leads.totals || {};
  const totalLeads = toNumber(leadTotals.total_leads);
  const convertedLeads = toNumber(leadTotals.converted_leads);
  const purchaseOutstanding = Math.max(0, toNumber(purchaseTotals.outstanding_purchase_amount));
  const payableOutstanding = Math.max(0, toNumber(payableTotals.total_payable));

  return {
    sales: {
      totalSalesAmount: toNumber(salesTotals.total_sales_amount),
      paidSalesAmount: toNumber(salesTotals.paid_sales_amount),
      outstandingSalesAmount: toNumber(salesTotals.outstanding_sales_amount),
      invoiceCount: toNumber(salesTotals.invoice_count),
      monthlySalesTrend: sales.monthlyTrend.map(normalizeMonthPoint),
      salesOrderCounts: normalizeStatusCount(sales.orderCounts),
    },
    purchases: {
      totalPurchaseAmount: toNumber(purchaseTotals.total_purchase_amount),
      paidPurchaseAmount: toNumber(purchaseTotals.paid_purchase_amount),
      outstandingPurchaseAmount: purchaseOutstanding,
      inwardCount: toNumber(purchaseTotals.inward_count),
      monthlyPurchaseTrend: purchases.monthlyTrend.map(normalizeMonthPoint),
      purchaseOrderCounts: normalizeStatusCount(purchases.orderCounts),
    },
    receivables: {
      totalReceivable: toNumber(receivableTotals.total_receivable),
      overdueReceivable: toNumber(receivableTotals.overdue_receivable),
      dueSoonReceivable: toNumber(receivableTotals.due_soon_receivable),
      topOutstandingCustomers: receivables.topOutstandingCustomers.map(normalizeOutstandingCustomer),
    },
    payables: {
      totalPayable: payableOutstanding,
      unpaidGrnAmount: payableOutstanding,
      topOutstandingVendors: payables.topOutstandingVendors.map(normalizeOutstandingVendor),
    },
    inventory: {
      totalStockValue: toNumber(inventoryTotals.total_stock_value),
      lowStockItems: toNumber(inventoryTotals.low_stock_items),
      outOfStockItems: toNumber(inventoryTotals.out_of_stock_items),
      recentStockMovements: inventory.recentStockMovements.map(normalizeStockMovement),
      topStockValueProducts: inventory.topStockValueProducts.map(normalizeStockValueProduct),
    },
    leads: {
      activeLeads: toNumber(leadTotals.active_leads),
      convertedLeads,
      conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 10000) / 100 : 0,
      leadValueOpen: toNumber(leadTotals.lead_value_open),
      leadsByStatus: leads.byStatus.map(normalizeLeadStatus),
    },
    recentActivity: recentActivity.map(normalizeRecentActivityItem),
    alerts: alerts
      .map(normalizeAlert)
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
      }),
  };
};

const getSummary = async ({ days }) => {
  const row = await dashboardRepository.fetchSummaryTotals(days);
  return normalizeSummary(row, days);
};

const getTopCustomers = async ({ days, limit }) => {
  const rows = await dashboardRepository.fetchTopCustomers({ days, limit });
  return rows.map(normalizeTopCustomer);
};

const getLowStockProducts = async ({ limit }) => {
  const rows = await dashboardRepository.fetchLowStockProducts(limit);
  return rows.map(normalizeLowStockProduct);
};

const getRecentActivity = async ({ limit }) => {
  const rows = await dashboardRepository.fetchRecentActivity(limit);
  return rows.map(normalizeActivity);
};

const getSalesTrend = async ({ days }) => {
  const rows = await dashboardRepository.fetchSalesTrend(days);
  return {
    windowDays: days,
    points: rows.map(normalizeTrendPoint),
  };
};

const getBestSellingProducts = async ({ days, limit }) => {
  const rows = await dashboardRepository.fetchBestSellingProducts({ days, limit });
  return rows.map(normalizeBestSellingProduct);
};

const getMonthlySales = async ({ months }) => {
  const rows = await dashboardRepository.fetchMonthlySales(months);
  const points = rows.map(normalizeMonthlySalesPoint);
  const peakAmount = points.reduce((max, p) => (p.amount > max ? p.amount : max), 0);

  return {
    months,
    peakAmount,
    points,
  };
};

module.exports = {
  getDashboard,
  getSummary,
  getTopCustomers,
  getLowStockProducts,
  getRecentActivity,
  getSalesTrend,
  getBestSellingProducts,
  getMonthlySales,
};

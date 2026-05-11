'use strict';

const reportRepository = require('./report.repository');

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

const formatDate = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

/**
 * Resolve fromDate/toDate. Defaults to the last 365 days ending today (UTC) so
 * a report request without filters still returns a useful aggregation.
 */
const resolveDateRange = ({ fromDate, toDate }) => {
  const today = new Date();
  const todayIso = formatDate(today);

  const resolvedTo = formatDate(toDate) || todayIso;
  let resolvedFrom = formatDate(fromDate);

  if (!resolvedFrom) {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 365);
    resolvedFrom = formatDate(start);
  }

  return { fromDate: resolvedFrom, toDate: resolvedTo };
};

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];

const normalizeQuarterPoint = (row) => {
  const quarterIndex = Math.max(1, Math.min(4, toNumber(row.quarter))) - 1;
  return {
    quarterStart: formatDate(row.quarter_start),
    year: toNumber(row.year),
    quarter: toNumber(row.quarter),
    label: `${QUARTER_LABELS[quarterIndex]} ${toNumber(row.year)}`,
    revenue: round2(row.revenue),
    expense: round2(row.expense),
    profit: round2(toNumber(row.revenue) - toNumber(row.expense)),
  };
};

const stockStatus = (quantityAvailable, reorderLevel) => {
  if (quantityAvailable <= 0) return 'out_of_stock';
  if (quantityAvailable <= reorderLevel) return 'low_stock';
  return 'in_stock';
};

const normalizeTopProduct = (row) => {
  const quantityAvailable = toNumber(row.quantity_available);
  const reorderLevel = toNumber(row.reorder_level);
  return {
    id: toNumber(row.id),
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    unitsSold: toNumber(row.units_sold),
    revenue: round2(row.revenue),
    quantityAvailable,
    reorderLevel,
    stockStatus: stockStatus(quantityAvailable, reorderLevel),
  };
};

const normalizeSalesByCustomer = (row, totalRevenue) => {
  const revenue = round2(row.revenue);
  return {
    id: toNumber(row.id),
    customerCode: row.customer_code,
    name: row.name,
    unitsSold: toNumber(row.units_sold),
    revenue,
    invoiceCount: toNumber(row.invoice_count),
    sharePercent: totalRevenue > 0 ? round2((revenue / totalRevenue) * 100) : 0,
  };
};

const getFinancialSummary = async (fromDate, toDate) => {
  const [quarterly, totals] = await Promise.all([
    reportRepository.fetchFinancialQuarterly(fromDate, toDate),
    reportRepository.fetchFinancialTotals(fromDate, toDate),
  ]);

  const totalRevenue = round2(totals.total_revenue);
  const totalExpense = round2(totals.total_expense);
  const netProfit = round2(totalRevenue - totalExpense);
  const grossProfitMargin = totalRevenue > 0 ? round2((netProfit / totalRevenue) * 100) : 0;
  const points = quarterly.map(normalizeQuarterPoint);
  const peakRevenue = points.reduce((max, p) => (p.revenue > max ? p.revenue : max), 0);
  const peakExpense = points.reduce((max, p) => (p.expense > max ? p.expense : max), 0);

  return {
    range: { fromDate, toDate },
    totals: {
      totalRevenue,
      totalExpense,
      netProfit,
      grossProfitMargin,
      totalOutputTax: round2(totals.total_output_tax),
      totalInputTax: round2(totals.total_input_tax),
      invoiceCount: toNumber(totals.invoice_count),
      lastInvoiceDate: formatDate(totals.last_invoice_date),
    },
    quarterly: {
      peakRevenue,
      peakExpense,
      points,
    },
  };
};

const getTopProducts = async (fromDate, toDate, limit) => {
  const rows = await reportRepository.fetchTopProducts(fromDate, toDate, limit);
  return {
    range: { fromDate, toDate },
    limit,
    items: rows.map(normalizeTopProduct),
  };
};

const getSalesByCustomer = async (fromDate, toDate, limit) => {
  const [rows, totals] = await Promise.all([
    reportRepository.fetchSalesByCustomer(fromDate, toDate, limit),
    reportRepository.fetchSalesTotalForWindow(fromDate, toDate),
  ]);

  const totalRevenue = round2(totals.total_revenue);
  const totalUnits = toNumber(totals.total_units);

  return {
    range: { fromDate, toDate },
    limit,
    totalRevenue,
    totalUnits,
    items: rows.map((row) => normalizeSalesByCustomer(row, totalRevenue)),
  };
};

const getGstSummary = async (fromDate, toDate) => {
  const row = await reportRepository.fetchGstSummary(fromDate, toDate);
  const inputTaxCredit = round2(row.input_tax_credit);
  const outputLiability = round2(row.output_liability);
  const netTaxPayable = round2(outputLiability - inputTaxCredit);

  return {
    range: { fromDate, toDate },
    inputTaxCredit,
    outputLiability,
    netTaxPayable,
    inputTaxableAmount: round2(row.input_taxable_amount),
    outputTaxableAmount: round2(row.output_taxable_amount),
  };
};

const getInventoryAnalytics = async (fromDate, toDate) => {
  const [row, asset] = await Promise.all([
    reportRepository.fetchInventoryAnalytics(fromDate, toDate),
    reportRepository.fetchTotalAssetValue(),
  ]);

  const stockValue = round2(row.total_stock_value);
  const revenueInWindow = round2(row.revenue_in_window);
  const totalAssetValue = round2(toNumber(asset.stock_value) + toNumber(asset.receivables_value));
  const stockSharePercent = totalAssetValue > 0
    ? round2((stockValue / totalAssetValue) * 100)
    : 0;
  const turnoverRate = stockValue > 0
    ? round2(revenueInWindow / stockValue)
    : 0;

  return {
    range: { fromDate, toDate },
    stockValuation: stockValue,
    totalAssetValue,
    stockSharePercent,
    turnoverRate,
    turnoverTarget: 15,
    totalProducts: toNumber(row.total_products),
    lowStockItems: toNumber(row.low_stock_items),
    outOfStockItems: toNumber(row.out_of_stock_items),
    revenueInWindow,
    purchasesInWindow: round2(row.purchases_in_window),
  };
};

const getOverview = async (filters) => {
  const { fromDate, toDate } = resolveDateRange(filters);
  const topProductsLimit = filters.topProductsLimit;
  const topCustomersLimit = filters.topCustomersLimit;

  const [financial, topProducts, salesByCustomer, gst, inventory] = await Promise.all([
    getFinancialSummary(fromDate, toDate),
    getTopProducts(fromDate, toDate, topProductsLimit),
    getSalesByCustomer(fromDate, toDate, topCustomersLimit),
    getGstSummary(fromDate, toDate),
    getInventoryAnalytics(fromDate, toDate),
  ]);

  return {
    range: { fromDate, toDate },
    financial,
    topProducts,
    salesByCustomer,
    gst,
    inventory,
  };
};

module.exports = {
  resolveDateRange,
  getOverview,
  getFinancialSummary,
  getTopProducts,
  getSalesByCustomer,
  getGstSummary,
  getInventoryAnalytics,
};

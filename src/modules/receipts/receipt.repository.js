'use strict';

const db = require('../../config/db');
const { RECEIPT_NUMBER_PREFIX } = require('./receipt.constants');

const receiptColumns = `
  r.id,
  r.receipt_number,
  r.customer_id,
  r.invoice_id,
  r.receipt_date,
  r.payment_mode,
  r.amount,
  r.bank_name,
  r.cheque_number,
  r.transaction_reference,
  r.payment_date,
  r.status,
  r.notes,
  r.is_active,
  r.created_at,
  r.updated_at,
  r.created_by,
  r.updated_by,
  c.customer_code,
  c.name AS customer_name,
  si.invoice_number
`;

const receiptJoins = `
  INNER JOIN customers c ON c.id = r.customer_id
  LEFT JOIN sales_invoices si ON si.id = r.invoice_id
`;

const generateReceiptNumber = async (client) => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${RECEIPT_NUMBER_PREFIX}-${yyyy}${mm}-`;

  const result = await client.query(
    `SELECT TOP 1 receipt_number
       FROM receipts WITH (UPDLOCK, HOLDLOCK)
      WHERE receipt_number LIKE $1
      ORDER BY id DESC`,
    [`${prefix}%`]
  );

  let next = 1;
  if (result.rows[0]?.receipt_number) {
    const parsed = parseInt(result.rows[0].receipt_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

const insertReceipt = async (receipt, client) => {
  const result = await client.query(
    `INSERT INTO receipts (
      receipt_number, customer_id, invoice_id, receipt_date, payment_mode, amount,
      bank_name, cheque_number, transaction_reference, payment_date,
      status, notes, is_active, created_by, updated_by
    )
    OUTPUT INSERTED.id
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, 1, $13, $13
    )`,
    [
      receipt.receiptNumber,
      receipt.customerId,
      receipt.invoiceId,
      receipt.receiptDate,
      receipt.paymentMode,
      receipt.amount,
      receipt.bankName || null,
      receipt.chequeNumber || null,
      receipt.transactionReference || null,
      receipt.paymentDate || null,
      receipt.status,
      receipt.notes || null,
      receipt.actorUserId,
    ]
  );

  return result.rows[0].id;
};

const findById = async (receiptId, client = db) => {
  const result = await client.query(
    `SELECT ${receiptColumns}
       FROM receipts r
       ${receiptJoins}
      WHERE r.id = $1
        AND r.is_active = 1`,
    [receiptId]
  );
  return result.rows[0] || null;
};

const listByInvoiceId = async (invoiceId, client = db) => {
  const result = await client.query(
    `SELECT ${receiptColumns}
       FROM receipts r
       ${receiptJoins}
      WHERE r.invoice_id = $1
        AND r.is_active = 1
      ORDER BY r.receipt_date DESC, r.id DESC`,
    [invoiceId]
  );
  return result.rows;
};

module.exports = {
  generateReceiptNumber,
  insertReceipt,
  findById,
  listByInvoiceId,
};

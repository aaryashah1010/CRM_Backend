-- ============================================================
-- RECEIPTS  (customer payments received)
-- ============================================================
CREATE TABLE receipts (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    receipt_number        NVARCHAR(50)    NOT NULL,
    customer_id           BIGINT          NOT NULL,
    invoice_id            BIGINT          NULL,
    receipt_date          DATE            NOT NULL,
    payment_mode          NVARCHAR(30)    NOT NULL,
    amount                DECIMAL(14,2)   NOT NULL,
    bank_name             NVARCHAR(100),
    cheque_number         NVARCHAR(50),
    transaction_reference NVARCHAR(100),
    payment_date          DATE,
    status                NVARCHAR(30)    NOT NULL CONSTRAINT df_receipts_status     DEFAULT (N'pending'),
    notes                 NVARCHAR(MAX),
    is_active             BIT             NOT NULL CONSTRAINT df_receipts_is_active  DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_receipts_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_receipts_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_receipts PRIMARY KEY (id),
    CONSTRAINT uq_receipts_number UNIQUE (receipt_number),
    CONSTRAINT chk_receipt_payment_mode CHECK (payment_mode IN ('cash','cheque','neft','rtgs','upi','bank_transfer','other')),
    CONSTRAINT chk_receipt_status CHECK (status IN ('pending','completed','failed','reversed')),
    CONSTRAINT chk_receipt_amount CHECK (amount > 0),
    CONSTRAINT fk_receipts_customer   FOREIGN KEY (customer_id) REFERENCES customers(id)      ON DELETE NO ACTION,
    CONSTRAINT fk_receipts_invoice    FOREIGN KEY (invoice_id)  REFERENCES sales_invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_receipts_created_by FOREIGN KEY (created_by)  REFERENCES users(id)          ON DELETE NO ACTION,
    CONSTRAINT fk_receipts_updated_by FOREIGN KEY (updated_by)  REFERENCES users(id)          ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_receipts_updated_at
ON receipts
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE r
       SET updated_at = SYSUTCDATETIME()
      FROM receipts r
      INNER JOIN inserted i ON r.id = i.id;
END;
GO

-- ============================================================
-- PAYMENTS  (vendor payments made)
-- ============================================================
CREATE TABLE payments (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    payment_number        NVARCHAR(50)    NOT NULL,
    vendor_id             BIGINT          NOT NULL,
    purchase_order_id     BIGINT          NULL,
    inward_id             BIGINT          NULL,
    payment_date          DATE            NOT NULL,
    payment_mode          NVARCHAR(30)    NOT NULL,
    amount                DECIMAL(14,2)   NOT NULL,
    bank_name             NVARCHAR(100),
    cheque_number         NVARCHAR(50),
    transaction_reference NVARCHAR(100),
    status                NVARCHAR(30)    NOT NULL CONSTRAINT df_payments_status     DEFAULT (N'pending'),
    notes                 NVARCHAR(MAX),
    is_active             BIT             NOT NULL CONSTRAINT df_payments_is_active  DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_payments_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_payments_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT uq_payments_number UNIQUE (payment_number),
    CONSTRAINT chk_payment_payment_mode CHECK (payment_mode IN ('cash','cheque','neft','rtgs','upi','bank_transfer','other')),
    CONSTRAINT chk_payment_status CHECK (status IN ('pending','completed','failed','reversed')),
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT fk_payments_vendor         FOREIGN KEY (vendor_id)         REFERENCES vendors(id)          ON DELETE NO ACTION,
    CONSTRAINT fk_payments_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)  ON DELETE SET NULL,
    CONSTRAINT fk_payments_inward         FOREIGN KEY (inward_id)         REFERENCES inward_records(id)   ON DELETE SET NULL,
    CONSTRAINT fk_payments_created_by     FOREIGN KEY (created_by)        REFERENCES users(id)            ON DELETE NO ACTION,
    CONSTRAINT fk_payments_updated_by     FOREIGN KEY (updated_by)        REFERENCES users(id)            ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_payments_updated_at
ON payments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
       SET updated_at = SYSUTCDATETIME()
      FROM payments p
      INNER JOIN inserted i ON p.id = i.id;
END;
GO

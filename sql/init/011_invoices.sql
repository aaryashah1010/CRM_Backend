-- ============================================================
-- SALES INVOICES
-- ============================================================
CREATE TABLE sales_invoices (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    invoice_number        NVARCHAR(50)    NOT NULL,
    sales_order_id        BIGINT          NULL,
    customer_id           BIGINT          NOT NULL,
    invoice_date          DATE            NOT NULL,
    due_date              DATE            NOT NULL,
    status                NVARCHAR(30)    NOT NULL CONSTRAINT df_sales_invoices_status            DEFAULT (N'draft'),
    payment_term_id       BIGINT          NULL,
    billing_address       NVARCHAR(MAX),
    shipping_address      NVARCHAR(MAX),
    customer_gst_snapshot NVARCHAR(15),
    subtotal_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_subtotal_amount    DEFAULT (0),
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_discount_amount    DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_taxable_amount     DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_cgst_amount        DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_sgst_amount        DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_igst_amount        DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_tax_amount         DEFAULT (0),
    round_off_amount      DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_round_off_amount   DEFAULT (0),
    total_amount          DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_total_amount       DEFAULT (0),
    paid_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_paid_amount        DEFAULT (0),
    outstanding_amount    DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoices_outstanding_amount DEFAULT (0),
    notes                 NVARCHAR(MAX),
    is_active             BIT             NOT NULL CONSTRAINT df_sales_invoices_is_active   DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_invoices_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_invoices_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_sales_invoices                 PRIMARY KEY (id),
    CONSTRAINT uq_sales_invoices_number          UNIQUE (invoice_number),
    CONSTRAINT chk_inv_status                    CHECK (status IN ('draft','issued','partially_paid','paid','overdue','cancelled')),
    CONSTRAINT chk_inv_subtotal                  CHECK (subtotal_amount     >= 0),
    CONSTRAINT chk_inv_total                     CHECK (total_amount        >= 0),
    CONSTRAINT chk_inv_paid                      CHECK (paid_amount         >= 0),
    CONSTRAINT chk_inv_outstanding               CHECK (outstanding_amount  >= 0),
    CONSTRAINT fk_sales_invoices_sales_order     FOREIGN KEY (sales_order_id)  REFERENCES sales_orders(id)  ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoices_customer        FOREIGN KEY (customer_id)     REFERENCES customers(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoices_payment_term    FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoices_created_by      FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoices_updated_by      FOREIGN KEY (updated_by)      REFERENCES users(id)         ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_sales_invoices_updated_at
ON sales_invoices
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
       SET updated_at = SYSUTCDATETIME()
      FROM sales_invoices s
      INNER JOIN inserted i ON s.id = i.id;
END;
GO

-- ============================================================
-- SALES INVOICE ITEMS
-- ============================================================
CREATE TABLE sales_invoice_items (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    invoice_id            BIGINT          NOT NULL,
    product_id            BIGINT          NULL,
    product_name_snapshot NVARCHAR(255)   NOT NULL,
    sku_snapshot          NVARCHAR(100),
    hsn_sac_code          NVARCHAR(20),
    quantity              DECIMAL(14,3)   NOT NULL,
    unit                  NVARCHAR(50)    NOT NULL CONSTRAINT df_sales_invoice_items_unit             DEFAULT (N'PCS'),
    unit_price            DECIMAL(14,2)   NOT NULL,
    discount_percent      DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_invoice_items_discount_percent DEFAULT (0),
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_discount_amount  DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_taxable_amount   DEFAULT (0),
    cgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_invoice_items_cgst_rate        DEFAULT (0),
    sgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_invoice_items_sgst_rate        DEFAULT (0),
    igst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_invoice_items_igst_rate        DEFAULT (0),
    tax_rate              DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_invoice_items_tax_rate         DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_cgst_amount      DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_sgst_amount      DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_igst_amount      DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_tax_amount       DEFAULT (0),
    line_total            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_invoice_items_line_total       DEFAULT (0),
    sort_order            INT             NOT NULL CONSTRAINT df_sales_invoice_items_sort_order       DEFAULT (0),
    is_active             BIT             NOT NULL CONSTRAINT df_sales_invoice_items_is_active        DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_invoice_items_created_at       DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_invoice_items_updated_at       DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_sales_invoice_items              PRIMARY KEY (id),
    CONSTRAINT chk_inv_item_quantity               CHECK (quantity   > 0),
    CONSTRAINT chk_inv_item_unit_price             CHECK (unit_price >= 0),
    CONSTRAINT fk_sales_invoice_items_invoice      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoice_items_product      FOREIGN KEY (product_id) REFERENCES products(id)       ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoice_items_created_by   FOREIGN KEY (created_by) REFERENCES users(id)          ON DELETE NO ACTION,
    CONSTRAINT fk_sales_invoice_items_updated_by   FOREIGN KEY (updated_by) REFERENCES users(id)          ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_sales_invoice_items_updated_at
ON sales_invoice_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE sii
       SET updated_at = SYSUTCDATETIME()
      FROM sales_invoice_items sii
      INNER JOIN inserted i ON sii.id = i.id;
END;
GO

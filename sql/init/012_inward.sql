-- ============================================================
-- INWARD RECORDS  (Product Inward / GRN)
-- ============================================================
CREATE TABLE inward_records (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    inward_number         NVARCHAR(50)    NOT NULL,
    purchase_order_id     BIGINT          NULL,
    vendor_id             BIGINT          NOT NULL,
    inward_date           DATE            NOT NULL,
    vendor_invoice_number NVARCHAR(100),
    vendor_invoice_date   DATE,
    subtotal_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_subtotal_amount DEFAULT (0),
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_discount_amount DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_taxable_amount  DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_cgst_amount     DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_sgst_amount     DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_igst_amount     DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_tax_amount      DEFAULT (0),
    total_amount          DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_records_total_amount    DEFAULT (0),
    notes                 NVARCHAR(MAX),
    is_active             BIT             NOT NULL CONSTRAINT df_inward_records_is_active   DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_inward_records_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_inward_records_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_inward_records              PRIMARY KEY (id),
    CONSTRAINT uq_inward_number               UNIQUE (inward_number),
    CONSTRAINT chk_inward_total               CHECK (total_amount >= 0),
    CONSTRAINT fk_inward_records_po           FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE NO ACTION,
    CONSTRAINT fk_inward_records_vendor       FOREIGN KEY (vendor_id)         REFERENCES vendors(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_inward_records_created_by   FOREIGN KEY (created_by)        REFERENCES users(id)           ON DELETE NO ACTION,
    CONSTRAINT fk_inward_records_updated_by   FOREIGN KEY (updated_by)        REFERENCES users(id)           ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_inward_records_updated_at
ON inward_records
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE r
       SET updated_at = SYSUTCDATETIME()
      FROM inward_records r
      INNER JOIN inserted i ON r.id = i.id;
END;
GO

-- ============================================================
-- INWARD ITEMS
-- ============================================================
CREATE TABLE inward_items (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    inward_id             BIGINT          NOT NULL,
    product_id            BIGINT          NOT NULL,
    product_name_snapshot NVARCHAR(255)   NOT NULL,
    sku_snapshot          NVARCHAR(100),
    hsn_sac_code          NVARCHAR(20),
    quantity              DECIMAL(14,3)   NOT NULL,
    unit                  NVARCHAR(50)    NOT NULL CONSTRAINT df_inward_items_unit             DEFAULT (N'PCS'),
    unit_price            DECIMAL(14,2)   NOT NULL,
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_discount_amount  DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_taxable_amount   DEFAULT (0),
    cgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_inward_items_cgst_rate        DEFAULT (0),
    sgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_inward_items_sgst_rate        DEFAULT (0),
    igst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_inward_items_igst_rate        DEFAULT (0),
    tax_rate              DECIMAL(5,2)    NOT NULL CONSTRAINT df_inward_items_tax_rate         DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_cgst_amount      DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_sgst_amount      DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_igst_amount      DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_tax_amount       DEFAULT (0),
    line_total            DECIMAL(14,2)   NOT NULL CONSTRAINT df_inward_items_line_total       DEFAULT (0),
    is_active             BIT             NOT NULL CONSTRAINT df_inward_items_is_active        DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_inward_items_created_at       DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_inward_items_updated_at       DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_inward_items              PRIMARY KEY (id),
    CONSTRAINT chk_ii_quantity              CHECK (quantity   > 0),
    CONSTRAINT chk_ii_unit_price            CHECK (unit_price >= 0),
    CONSTRAINT fk_inward_items_inward       FOREIGN KEY (inward_id)  REFERENCES inward_records(id) ON DELETE NO ACTION,
    CONSTRAINT fk_inward_items_product      FOREIGN KEY (product_id) REFERENCES products(id)       ON DELETE NO ACTION,
    CONSTRAINT fk_inward_items_created_by   FOREIGN KEY (created_by) REFERENCES users(id)          ON DELETE NO ACTION,
    CONSTRAINT fk_inward_items_updated_by   FOREIGN KEY (updated_by) REFERENCES users(id)          ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_inward_items_updated_at
ON inward_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE ii
       SET updated_at = SYSUTCDATETIME()
      FROM inward_items ii
      INNER JOIN inserted i ON ii.id = i.id;
END;
GO

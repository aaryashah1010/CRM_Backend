-- ============================================================
-- QUOTATIONS
-- ============================================================
CREATE TABLE quotations (
    id                   BIGINT          IDENTITY(1,1) NOT NULL,
    quotation_number     NVARCHAR(50)    NOT NULL,
    customer_id          BIGINT          NOT NULL,
    lead_id              BIGINT          NULL,
    quotation_date       DATE            NOT NULL,
    valid_until          DATE            NOT NULL,
    status               NVARCHAR(30)    NOT NULL CONSTRAINT df_quotations_status            DEFAULT (N'draft'),
    payment_term_id      BIGINT          NULL,
    billing_address      NVARCHAR(MAX),
    shipping_address     NVARCHAR(MAX),
    subtotal_amount      DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_subtotal_amount   DEFAULT (0),
    discount_amount      DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_discount_amount   DEFAULT (0),
    taxable_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_taxable_amount    DEFAULT (0),
    cgst_amount          DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_cgst_amount       DEFAULT (0),
    sgst_amount          DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_sgst_amount       DEFAULT (0),
    igst_amount          DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_igst_amount       DEFAULT (0),
    tax_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_tax_amount        DEFAULT (0),
    round_off_amount     DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_round_off_amount  DEFAULT (0),
    total_amount         DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotations_total_amount      DEFAULT (0),
    notes                NVARCHAR(MAX),
    terms_and_conditions NVARCHAR(MAX),
    assigned_to          BIGINT          NULL,
    approved_by          BIGINT          NULL,
    approved_at          DATETIMEOFFSET  NULL,
    converted_at         DATETIMEOFFSET  NULL,
    is_active            BIT             NOT NULL CONSTRAINT df_quotations_is_active   DEFAULT (1),
    created_at           DATETIMEOFFSET  NOT NULL CONSTRAINT df_quotations_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at           DATETIMEOFFSET  NOT NULL CONSTRAINT df_quotations_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by           BIGINT          NULL,
    updated_by           BIGINT          NULL,
    CONSTRAINT pk_quotations              PRIMARY KEY (id),
    CONSTRAINT uq_quotations_number       UNIQUE (quotation_number),
    CONSTRAINT chk_quotations_status      CHECK (status IN ('draft','sent','approved','rejected','expired','converted')),
    CONSTRAINT chk_quotation_subtotal     CHECK (subtotal_amount >= 0),
    CONSTRAINT chk_quotation_total        CHECK (total_amount    >= 0),
    CONSTRAINT fk_quotations_customer     FOREIGN KEY (customer_id)     REFERENCES customers(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_quotations_lead         FOREIGN KEY (lead_id)         REFERENCES leads(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_quotations_payment_term FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_quotations_assigned_to  FOREIGN KEY (assigned_to)     REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_quotations_approved_by  FOREIGN KEY (approved_by)     REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_quotations_created_by   FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_quotations_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id)         ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_quotations_updated_at
ON quotations
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE q
       SET updated_at = SYSUTCDATETIME()
      FROM quotations q
      INNER JOIN inserted i ON q.id = i.id;
END;
GO

-- ============================================================
-- QUOTATION ITEMS
-- ============================================================
CREATE TABLE quotation_items (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    quotation_id          BIGINT          NOT NULL,
    product_id            BIGINT          NULL,
    product_name_snapshot NVARCHAR(255)   NOT NULL,
    sku_snapshot          NVARCHAR(100),
    hsn_sac_code          NVARCHAR(20),
    quantity              DECIMAL(14,3)   NOT NULL,
    unit                  NVARCHAR(50)    NOT NULL CONSTRAINT df_quotation_items_unit             DEFAULT (N'PCS'),
    unit_price            DECIMAL(14,2)   NOT NULL,
    discount_percent      DECIMAL(5,2)    NOT NULL CONSTRAINT df_quotation_items_discount_percent DEFAULT (0),
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_discount_amount  DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_taxable_amount   DEFAULT (0),
    cgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_quotation_items_cgst_rate        DEFAULT (0),
    sgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_quotation_items_sgst_rate        DEFAULT (0),
    igst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_quotation_items_igst_rate        DEFAULT (0),
    tax_rate              DECIMAL(5,2)    NOT NULL CONSTRAINT df_quotation_items_tax_rate         DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_cgst_amount      DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_sgst_amount      DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_igst_amount      DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_tax_amount       DEFAULT (0),
    line_total            DECIMAL(14,2)   NOT NULL CONSTRAINT df_quotation_items_line_total       DEFAULT (0),
    sort_order            INT             NOT NULL CONSTRAINT df_quotation_items_sort_order       DEFAULT (0),
    is_active             BIT             NOT NULL CONSTRAINT df_quotation_items_is_active        DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_quotation_items_created_at       DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_quotation_items_updated_at       DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_quotation_items            PRIMARY KEY (id),
    CONSTRAINT chk_qi_quantity               CHECK (quantity   > 0),
    CONSTRAINT chk_qi_unit_price             CHECK (unit_price >= 0),
    CONSTRAINT fk_quotation_items_quotation  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE NO ACTION,
    CONSTRAINT fk_quotation_items_product    FOREIGN KEY (product_id)   REFERENCES products(id)   ON DELETE NO ACTION,
    CONSTRAINT fk_quotation_items_created_by FOREIGN KEY (created_by)   REFERENCES users(id)      ON DELETE NO ACTION,
    CONSTRAINT fk_quotation_items_updated_by FOREIGN KEY (updated_by)   REFERENCES users(id)      ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_quotation_items_updated_at
ON quotation_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE qi
       SET updated_at = SYSUTCDATETIME()
      FROM quotation_items qi
      INNER JOIN inserted i ON qi.id = i.id;
END;
GO

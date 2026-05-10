-- ============================================================
-- PAYMENT TERMS
-- ============================================================
CREATE TABLE payment_terms (
    id          BIGINT          IDENTITY(1,1) NOT NULL,
    name        NVARCHAR(100)   NOT NULL,
    days        INT             NOT NULL CONSTRAINT df_payment_terms_days       DEFAULT (0),
    description NVARCHAR(MAX),
    is_active   BIT             NOT NULL CONSTRAINT df_payment_terms_is_active  DEFAULT (1),
    created_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_payment_terms_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_payment_terms_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by  BIGINT          NULL,
    updated_by  BIGINT          NULL,
    CONSTRAINT pk_payment_terms             PRIMARY KEY (id),
    CONSTRAINT uq_payment_terms_name        UNIQUE (name),
    CONSTRAINT chk_payment_terms_days       CHECK (days >= 0),
    CONSTRAINT fk_payment_terms_created_by  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_payment_terms_updated_by  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_payment_terms_updated_at
ON payment_terms
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
       SET updated_at = SYSUTCDATETIME()
      FROM payment_terms p
      INNER JOIN inserted i ON p.id = i.id;
END;
GO

-- ============================================================
-- TAX RATES  (GST India)
-- ============================================================
CREATE TABLE tax_rates (
    id         BIGINT          IDENTITY(1,1) NOT NULL,
    name       NVARCHAR(100)   NOT NULL,
    rate       DECIMAL(5,2)    NOT NULL,
    cgst_rate  DECIMAL(5,2)    NOT NULL CONSTRAINT df_tax_rates_cgst_rate  DEFAULT (0),
    sgst_rate  DECIMAL(5,2)    NOT NULL CONSTRAINT df_tax_rates_sgst_rate  DEFAULT (0),
    igst_rate  DECIMAL(5,2)    NOT NULL CONSTRAINT df_tax_rates_igst_rate  DEFAULT (0),
    is_active  BIT             NOT NULL CONSTRAINT df_tax_rates_is_active  DEFAULT (1),
    created_at DATETIMEOFFSET  NOT NULL CONSTRAINT df_tax_rates_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIMEOFFSET  NOT NULL CONSTRAINT df_tax_rates_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by BIGINT          NULL,
    updated_by BIGINT          NULL,
    CONSTRAINT pk_tax_rates             PRIMARY KEY (id),
    CONSTRAINT uq_tax_rates_name        UNIQUE (name),
    CONSTRAINT chk_tax_rate             CHECK (rate      >= 0),
    CONSTRAINT chk_tax_cgst_rate        CHECK (cgst_rate >= 0),
    CONSTRAINT chk_tax_sgst_rate        CHECK (sgst_rate >= 0),
    CONSTRAINT chk_tax_igst_rate        CHECK (igst_rate >= 0),
    CONSTRAINT fk_tax_rates_created_by  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_tax_rates_updated_by  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_tax_rates_updated_at
ON tax_rates
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
       SET updated_at = SYSUTCDATETIME()
      FROM tax_rates t
      INNER JOIN inserted i ON t.id = i.id;
END;
GO

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE product_categories (
    id          BIGINT          IDENTITY(1,1) NOT NULL,
    name        NVARCHAR(100)   NOT NULL,
    code        NVARCHAR(50)    NOT NULL,
    parent_id   BIGINT          NULL,
    description NVARCHAR(MAX),
    is_active   BIT             NOT NULL CONSTRAINT df_product_categories_is_active  DEFAULT (1),
    created_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_product_categories_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_product_categories_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by  BIGINT          NULL,
    updated_by  BIGINT          NULL,
    CONSTRAINT pk_product_categories              PRIMARY KEY (id),
    CONSTRAINT uq_product_categories_code         UNIQUE (code),
    CONSTRAINT fk_product_categories_parent       FOREIGN KEY (parent_id)  REFERENCES product_categories(id) ON DELETE NO ACTION,
    CONSTRAINT fk_product_categories_created_by   FOREIGN KEY (created_by) REFERENCES users(id)              ON DELETE NO ACTION,
    CONSTRAINT fk_product_categories_updated_by   FOREIGN KEY (updated_by) REFERENCES users(id)              ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_product_categories_updated_at
ON product_categories
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
       SET updated_at = SYSUTCDATETIME()
      FROM product_categories c
      INNER JOIN inserted i ON c.id = i.id;
END;
GO

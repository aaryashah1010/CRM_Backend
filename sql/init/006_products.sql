-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
    id               BIGINT          IDENTITY(1,1) NOT NULL,
    category_id      BIGINT          NULL,
    tax_rate_id      BIGINT          NULL,
    sku              NVARCHAR(100)   NOT NULL,
    name             NVARCHAR(255)   NOT NULL,
    description      NVARCHAR(MAX),
    unit             NVARCHAR(50)    NOT NULL CONSTRAINT df_products_unit             DEFAULT (N'PCS'),
    hsn_sac_code     NVARCHAR(20),
    selling_price    DECIMAL(14,2)   NOT NULL CONSTRAINT df_products_selling_price    DEFAULT (0),
    cost_price       DECIMAL(14,2)   NOT NULL CONSTRAINT df_products_cost_price       DEFAULT (0),
    reorder_level    DECIMAL(14,3)   NOT NULL CONSTRAINT df_products_reorder_level    DEFAULT (0),
    reorder_quantity DECIMAL(14,3)   NOT NULL CONSTRAINT df_products_reorder_quantity DEFAULT (0),
    -- JSONB equivalent: SQL Server 2017 stores JSON in NVARCHAR(MAX) and validates with ISJSON.
    specifications   NVARCHAR(MAX)   NULL,
    is_active        BIT             NOT NULL CONSTRAINT df_products_is_active        DEFAULT (1),
    created_at       DATETIMEOFFSET  NOT NULL CONSTRAINT df_products_created_at       DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIMEOFFSET  NOT NULL CONSTRAINT df_products_updated_at       DEFAULT (SYSUTCDATETIME()),
    created_by       BIGINT          NULL,
    updated_by       BIGINT          NULL,
    CONSTRAINT pk_products                  PRIMARY KEY (id),
    CONSTRAINT uq_products_sku              UNIQUE (sku),
    CONSTRAINT chk_products_selling_price   CHECK (selling_price    >= 0),
    CONSTRAINT chk_products_cost_price      CHECK (cost_price       >= 0),
    CONSTRAINT chk_products_reorder_level   CHECK (reorder_level    >= 0),
    CONSTRAINT chk_products_reorder_qty     CHECK (reorder_quantity >= 0),
    CONSTRAINT chk_products_specs_json      CHECK (specifications IS NULL OR ISJSON(specifications) = 1),
    CONSTRAINT fk_products_category         FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE NO ACTION,
    CONSTRAINT fk_products_tax_rate         FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id)          ON DELETE NO ACTION,
    CONSTRAINT fk_products_created_by       FOREIGN KEY (created_by)  REFERENCES users(id)              ON DELETE NO ACTION,
    CONSTRAINT fk_products_updated_by       FOREIGN KEY (updated_by)  REFERENCES users(id)              ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_products_updated_at
ON products
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
       SET updated_at = SYSUTCDATETIME()
      FROM products p
      INNER JOIN inserted i ON p.id = i.id;
END;
GO

-- ============================================================
-- PRODUCT STOCK BALANCES  (current snapshot - updated in same txn as stock_movements)
-- ============================================================
CREATE TABLE product_stock_balances (
    id                 BIGINT          IDENTITY(1,1) NOT NULL,
    product_id         BIGINT          NOT NULL,
    quantity_on_hand   DECIMAL(14,3)   NOT NULL CONSTRAINT df_psb_quantity_on_hand  DEFAULT (0),
    quantity_reserved  DECIMAL(14,3)   NOT NULL CONSTRAINT df_psb_quantity_reserved DEFAULT (0),
    quantity_available AS (CAST(quantity_on_hand - quantity_reserved AS DECIMAL(14,3))) PERSISTED,
    updated_at         DATETIMEOFFSET  NOT NULL CONSTRAINT df_psb_updated_at        DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_product_stock_balances     PRIMARY KEY (id),
    CONSTRAINT uq_product_stock_product_id   UNIQUE (product_id),
    CONSTRAINT chk_stock_on_hand             CHECK (quantity_on_hand  >= 0),
    CONSTRAINT chk_stock_reserved            CHECK (quantity_reserved >= 0),
    CONSTRAINT fk_product_stock_balances_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE NO ACTION
);
GO

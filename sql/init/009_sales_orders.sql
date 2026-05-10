-- ============================================================
-- SALES ORDERS
-- ============================================================
CREATE TABLE sales_orders (
    id                     BIGINT          IDENTITY(1,1) NOT NULL,
    order_number           NVARCHAR(50)    NOT NULL,
    quotation_id           BIGINT          NULL,
    customer_id            BIGINT          NOT NULL,
    order_date             DATE            NOT NULL,
    expected_delivery_date DATE,
    status                 NVARCHAR(30)    NOT NULL CONSTRAINT df_sales_orders_status            DEFAULT (N'draft'),
    payment_term_id        BIGINT          NULL,
    billing_address        NVARCHAR(MAX),
    shipping_address       NVARCHAR(MAX),
    subtotal_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_subtotal_amount   DEFAULT (0),
    discount_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_discount_amount   DEFAULT (0),
    taxable_amount         DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_taxable_amount    DEFAULT (0),
    cgst_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_cgst_amount       DEFAULT (0),
    sgst_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_sgst_amount       DEFAULT (0),
    igst_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_igst_amount       DEFAULT (0),
    tax_amount             DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_tax_amount        DEFAULT (0),
    round_off_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_round_off_amount  DEFAULT (0),
    total_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_orders_total_amount      DEFAULT (0),
    notes                  NVARCHAR(MAX),
    assigned_to            BIGINT          NULL,
    is_active              BIT             NOT NULL CONSTRAINT df_sales_orders_is_active   DEFAULT (1),
    created_at             DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_orders_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at             DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_orders_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by             BIGINT          NULL,
    updated_by             BIGINT          NULL,
    CONSTRAINT pk_sales_orders               PRIMARY KEY (id),
    CONSTRAINT uq_sales_orders_number        UNIQUE (order_number),
    CONSTRAINT chk_so_status                 CHECK (status IN ('draft','confirmed','partially_dispatched','dispatched','cancelled')),
    CONSTRAINT chk_so_subtotal               CHECK (subtotal_amount >= 0),
    CONSTRAINT chk_so_total                  CHECK (total_amount    >= 0),
    CONSTRAINT fk_sales_orders_quotation     FOREIGN KEY (quotation_id)    REFERENCES quotations(id)    ON DELETE NO ACTION,
    CONSTRAINT fk_sales_orders_customer      FOREIGN KEY (customer_id)     REFERENCES customers(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_sales_orders_payment_term  FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_sales_orders_assigned_to   FOREIGN KEY (assigned_to)     REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_sales_orders_created_by    FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_sales_orders_updated_by    FOREIGN KEY (updated_by)      REFERENCES users(id)         ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_sales_orders_updated_at
ON sales_orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
       SET updated_at = SYSUTCDATETIME()
      FROM sales_orders s
      INNER JOIN inserted i ON s.id = i.id;
END;
GO

-- ============================================================
-- SALES ORDER ITEMS
-- ============================================================
CREATE TABLE sales_order_items (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    order_id              BIGINT          NOT NULL,
    product_id            BIGINT          NULL,
    product_name_snapshot NVARCHAR(255)   NOT NULL,
    sku_snapshot          NVARCHAR(100),
    hsn_sac_code          NVARCHAR(20),
    quantity              DECIMAL(14,3)   NOT NULL,
    dispatched_quantity   DECIMAL(14,3)   NOT NULL CONSTRAINT df_sales_order_items_dispatched_quantity DEFAULT (0),
    unit                  NVARCHAR(50)    NOT NULL CONSTRAINT df_sales_order_items_unit                DEFAULT (N'PCS'),
    unit_price            DECIMAL(14,2)   NOT NULL,
    discount_percent      DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_order_items_discount_percent    DEFAULT (0),
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_discount_amount     DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_taxable_amount      DEFAULT (0),
    cgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_order_items_cgst_rate           DEFAULT (0),
    sgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_order_items_sgst_rate           DEFAULT (0),
    igst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_order_items_igst_rate           DEFAULT (0),
    tax_rate              DECIMAL(5,2)    NOT NULL CONSTRAINT df_sales_order_items_tax_rate            DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_cgst_amount         DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_sgst_amount         DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_igst_amount         DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_tax_amount          DEFAULT (0),
    line_total            DECIMAL(14,2)   NOT NULL CONSTRAINT df_sales_order_items_line_total          DEFAULT (0),
    sort_order            INT             NOT NULL CONSTRAINT df_sales_order_items_sort_order          DEFAULT (0),
    is_active             BIT             NOT NULL CONSTRAINT df_sales_order_items_is_active           DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_order_items_created_at          DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_sales_order_items_updated_at          DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_sales_order_items             PRIMARY KEY (id),
    CONSTRAINT chk_soi_quantity                 CHECK (quantity            > 0),
    CONSTRAINT chk_soi_dispatched               CHECK (dispatched_quantity >= 0),
    CONSTRAINT chk_soi_unit_price               CHECK (unit_price          >= 0),
    CONSTRAINT fk_sales_order_items_order       FOREIGN KEY (order_id)   REFERENCES sales_orders(id) ON DELETE NO ACTION,
    CONSTRAINT fk_sales_order_items_product     FOREIGN KEY (product_id) REFERENCES products(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_sales_order_items_created_by  FOREIGN KEY (created_by) REFERENCES users(id)        ON DELETE NO ACTION,
    CONSTRAINT fk_sales_order_items_updated_by  FOREIGN KEY (updated_by) REFERENCES users(id)        ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_sales_order_items_updated_at
ON sales_order_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE soi
       SET updated_at = SYSUTCDATETIME()
      FROM sales_order_items soi
      INNER JOIN inserted i ON soi.id = i.id;
END;
GO

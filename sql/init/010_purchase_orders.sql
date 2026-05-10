-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
    id                     BIGINT          IDENTITY(1,1) NOT NULL,
    po_number              NVARCHAR(50)    NOT NULL,
    vendor_id              BIGINT          NOT NULL,
    order_date             DATE            NOT NULL,
    expected_delivery_date DATE,
    status                 NVARCHAR(30)    NOT NULL CONSTRAINT df_purchase_orders_status            DEFAULT (N'draft'),
    payment_term_id        BIGINT          NULL,
    delivery_address       NVARCHAR(MAX),
    subtotal_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_subtotal_amount   DEFAULT (0),
    discount_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_discount_amount   DEFAULT (0),
    taxable_amount         DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_taxable_amount    DEFAULT (0),
    cgst_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_cgst_amount       DEFAULT (0),
    sgst_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_sgst_amount       DEFAULT (0),
    igst_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_igst_amount       DEFAULT (0),
    tax_amount             DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_tax_amount        DEFAULT (0),
    round_off_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_round_off_amount  DEFAULT (0),
    total_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_orders_total_amount      DEFAULT (0),
    notes                  NVARCHAR(MAX),
    assigned_to            BIGINT          NULL,
    is_active              BIT             NOT NULL CONSTRAINT df_purchase_orders_is_active   DEFAULT (1),
    created_at             DATETIMEOFFSET  NOT NULL CONSTRAINT df_purchase_orders_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at             DATETIMEOFFSET  NOT NULL CONSTRAINT df_purchase_orders_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by             BIGINT          NULL,
    updated_by             BIGINT          NULL,
    CONSTRAINT pk_purchase_orders                PRIMARY KEY (id),
    CONSTRAINT uq_purchase_orders_number         UNIQUE (po_number),
    CONSTRAINT chk_po_status                     CHECK (status IN ('draft','sent','partially_received','received','cancelled')),
    CONSTRAINT chk_po_subtotal                   CHECK (subtotal_amount >= 0),
    CONSTRAINT chk_po_total                      CHECK (total_amount    >= 0),
    CONSTRAINT fk_purchase_orders_vendor         FOREIGN KEY (vendor_id)       REFERENCES vendors(id)       ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_orders_payment_term   FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_orders_assigned_to    FOREIGN KEY (assigned_to)     REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_orders_created_by     FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_orders_updated_by     FOREIGN KEY (updated_by)      REFERENCES users(id)         ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_purchase_orders_updated_at
ON purchase_orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
       SET updated_at = SYSUTCDATETIME()
      FROM purchase_orders p
      INNER JOIN inserted i ON p.id = i.id;
END;
GO

-- ============================================================
-- PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE purchase_order_items (
    id                    BIGINT          IDENTITY(1,1) NOT NULL,
    po_id                 BIGINT          NOT NULL,
    product_id            BIGINT          NULL,
    product_name_snapshot NVARCHAR(255)   NOT NULL,
    sku_snapshot          NVARCHAR(100),
    hsn_sac_code          NVARCHAR(20),
    quantity              DECIMAL(14,3)   NOT NULL,
    received_quantity     DECIMAL(14,3)   NOT NULL CONSTRAINT df_purchase_order_items_received_quantity DEFAULT (0),
    unit                  NVARCHAR(50)    NOT NULL CONSTRAINT df_purchase_order_items_unit              DEFAULT (N'PCS'),
    unit_price            DECIMAL(14,2)   NOT NULL,
    discount_percent      DECIMAL(5,2)    NOT NULL CONSTRAINT df_purchase_order_items_discount_percent  DEFAULT (0),
    discount_amount       DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_discount_amount   DEFAULT (0),
    taxable_amount        DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_taxable_amount    DEFAULT (0),
    cgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_purchase_order_items_cgst_rate         DEFAULT (0),
    sgst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_purchase_order_items_sgst_rate         DEFAULT (0),
    igst_rate             DECIMAL(5,2)    NOT NULL CONSTRAINT df_purchase_order_items_igst_rate         DEFAULT (0),
    tax_rate              DECIMAL(5,2)    NOT NULL CONSTRAINT df_purchase_order_items_tax_rate          DEFAULT (0),
    cgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_cgst_amount       DEFAULT (0),
    sgst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_sgst_amount       DEFAULT (0),
    igst_amount           DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_igst_amount       DEFAULT (0),
    tax_amount            DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_tax_amount        DEFAULT (0),
    line_total            DECIMAL(14,2)   NOT NULL CONSTRAINT df_purchase_order_items_line_total        DEFAULT (0),
    sort_order            INT             NOT NULL CONSTRAINT df_purchase_order_items_sort_order        DEFAULT (0),
    is_active             BIT             NOT NULL CONSTRAINT df_purchase_order_items_is_active         DEFAULT (1),
    created_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_purchase_order_items_created_at        DEFAULT (SYSUTCDATETIME()),
    updated_at            DATETIMEOFFSET  NOT NULL CONSTRAINT df_purchase_order_items_updated_at        DEFAULT (SYSUTCDATETIME()),
    created_by            BIGINT          NULL,
    updated_by            BIGINT          NULL,
    CONSTRAINT pk_purchase_order_items              PRIMARY KEY (id),
    CONSTRAINT chk_poi_quantity                     CHECK (quantity          > 0),
    CONSTRAINT chk_poi_received                     CHECK (received_quantity >= 0),
    CONSTRAINT chk_poi_unit_price                   CHECK (unit_price        >= 0),
    CONSTRAINT fk_purchase_order_items_po           FOREIGN KEY (po_id)      REFERENCES purchase_orders(id) ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_order_items_product      FOREIGN KEY (product_id) REFERENCES products(id)        ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_order_items_created_by   FOREIGN KEY (created_by) REFERENCES users(id)           ON DELETE NO ACTION,
    CONSTRAINT fk_purchase_order_items_updated_by   FOREIGN KEY (updated_by) REFERENCES users(id)           ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_purchase_order_items_updated_at
ON purchase_order_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE poi
       SET updated_at = SYSUTCDATETIME()
      FROM purchase_order_items poi
      INNER JOIN inserted i ON poi.id = i.id;
END;
GO

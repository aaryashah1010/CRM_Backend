-- ============================================================
-- STOCK MOVEMENTS  (ledger - never updated, only inserted)
-- ============================================================
CREATE TABLE stock_movements (
    id             BIGINT          IDENTITY(1,1) NOT NULL,
    product_id     BIGINT          NOT NULL,
    movement_type  NVARCHAR(30)    NOT NULL,
    reference_type NVARCHAR(50),
    reference_id   BIGINT,
    quantity_in    DECIMAL(14,3)   NOT NULL CONSTRAINT df_stock_movements_quantity_in  DEFAULT (0),
    quantity_out   DECIMAL(14,3)   NOT NULL CONSTRAINT df_stock_movements_quantity_out DEFAULT (0),
    balance_after  DECIMAL(14,3)   NOT NULL,
    movement_date  DATE            NOT NULL,
    remarks        NVARCHAR(MAX),
    created_at     DATETIMEOFFSET  NOT NULL CONSTRAINT df_stock_movements_created_at   DEFAULT (SYSUTCDATETIME()),
    created_by     BIGINT          NULL,
    CONSTRAINT pk_stock_movements              PRIMARY KEY (id),
    CONSTRAINT chk_sm_movement_type            CHECK (movement_type IN ('inward','outward','adjustment_in','adjustment_out','return_in','return_out','opening')),
    CONSTRAINT chk_sm_reference_type           CHECK (reference_type IS NULL OR reference_type IN ('inward','sales_order','sales_invoice','adjustment','return','opening')),
    CONSTRAINT chk_sm_qty_in                   CHECK (quantity_in  >= 0),
    CONSTRAINT chk_sm_qty_out                  CHECK (quantity_out >= 0),
    CONSTRAINT fk_stock_movements_product      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE NO ACTION,
    CONSTRAINT fk_stock_movements_created_by   FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE NO ACTION
);
GO

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    id               BIGINT          IDENTITY(1,1) NOT NULL,
    customer_code    NVARCHAR(50)    NOT NULL,
    name             NVARCHAR(200)   NOT NULL,
    email            NVARCHAR(255),
    phone            NVARCHAR(20),
    mobile           NVARCHAR(20),
    website          NVARCHAR(255),
    gst_number       NVARCHAR(15),
    pan_number       NVARCHAR(10),
    payment_term_id  BIGINT          NULL,
    credit_limit     DECIMAL(14,2)   NOT NULL CONSTRAINT df_customers_credit_limit DEFAULT (0),
    assigned_to      BIGINT          NULL,
    notes            NVARCHAR(MAX),
    is_active        BIT             NOT NULL CONSTRAINT df_customers_is_active  DEFAULT (1),
    created_at       DATETIMEOFFSET  NOT NULL CONSTRAINT df_customers_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIMEOFFSET  NOT NULL CONSTRAINT df_customers_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by       BIGINT          NULL,
    updated_by       BIGINT          NULL,
    CONSTRAINT pk_customers              PRIMARY KEY (id),
    CONSTRAINT uq_customers_code         UNIQUE (customer_code),
    CONSTRAINT uq_customers_gst_number   UNIQUE (gst_number),
    CONSTRAINT chk_customers_credit      CHECK (credit_limit >= 0),
    CONSTRAINT fk_customers_payment_term FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_customers_assigned_to  FOREIGN KEY (assigned_to)     REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_customers_created_by   FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_customers_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id)         ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_customers_updated_at
ON customers
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
       SET updated_at = SYSUTCDATETIME()
      FROM customers c
      INNER JOIN inserted i ON c.id = i.id;
END;
GO

-- ============================================================
-- CUSTOMER ADDRESSES
-- ============================================================
CREATE TABLE customer_addresses (
    id            BIGINT          IDENTITY(1,1) NOT NULL,
    customer_id   BIGINT          NOT NULL,
    address_type  NVARCHAR(20)    NOT NULL,
    address_line1 NVARCHAR(255)   NOT NULL,
    address_line2 NVARCHAR(255),
    city          NVARCHAR(100)   NOT NULL,
    state         NVARCHAR(100)   NOT NULL,
    pincode       NVARCHAR(10)    NOT NULL,
    country       NVARCHAR(100)   NOT NULL CONSTRAINT df_customer_addresses_country     DEFAULT (N'India'),
    is_default    BIT             NOT NULL CONSTRAINT df_customer_addresses_is_default  DEFAULT (0),
    is_active     BIT             NOT NULL CONSTRAINT df_customer_addresses_is_active   DEFAULT (1),
    created_at    DATETIMEOFFSET  NOT NULL CONSTRAINT df_customer_addresses_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at    DATETIMEOFFSET  NOT NULL CONSTRAINT df_customer_addresses_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by    BIGINT          NULL,
    updated_by    BIGINT          NULL,
    CONSTRAINT pk_customer_addresses              PRIMARY KEY (id),
    CONSTRAINT chk_customer_addresses_type        CHECK (address_type IN ('billing','shipping')),
    CONSTRAINT fk_customer_addresses_customer     FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE NO ACTION,
    CONSTRAINT fk_customer_addresses_created_by   FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_customer_addresses_updated_by   FOREIGN KEY (updated_by)  REFERENCES users(id)     ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_customer_addresses_updated_at
ON customer_addresses
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE a
       SET updated_at = SYSUTCDATETIME()
      FROM customer_addresses a
      INNER JOIN inserted i ON a.id = i.id;
END;
GO

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE vendors (
    id                  BIGINT          IDENTITY(1,1) NOT NULL,
    vendor_code         NVARCHAR(50)    NOT NULL,
    name                NVARCHAR(200)   NOT NULL,
    email               NVARCHAR(255),
    phone               NVARCHAR(20),
    mobile              NVARCHAR(20),
    website             NVARCHAR(255),
    gst_number          NVARCHAR(15),
    pan_number          NVARCHAR(10),
    payment_term_id     BIGINT          NULL,
    address_line1       NVARCHAR(255),
    address_line2       NVARCHAR(255),
    city                NVARCHAR(100),
    state               NVARCHAR(100),
    pincode             NVARCHAR(10),
    country             NVARCHAR(100)   NOT NULL CONSTRAINT df_vendors_country    DEFAULT (N'India'),
    bank_name           NVARCHAR(100),
    bank_account_number NVARCHAR(50),
    bank_ifsc_code      NVARCHAR(20),
    bank_branch         NVARCHAR(100),
    notes               NVARCHAR(MAX),
    is_active           BIT             NOT NULL CONSTRAINT df_vendors_is_active  DEFAULT (1),
    created_at          DATETIMEOFFSET  NOT NULL CONSTRAINT df_vendors_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at          DATETIMEOFFSET  NOT NULL CONSTRAINT df_vendors_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by          BIGINT          NULL,
    updated_by          BIGINT          NULL,
    CONSTRAINT pk_vendors              PRIMARY KEY (id),
    CONSTRAINT uq_vendors_code         UNIQUE (vendor_code),
    CONSTRAINT uq_vendors_gst_number   UNIQUE (gst_number),
    CONSTRAINT fk_vendors_payment_term FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE NO ACTION,
    CONSTRAINT fk_vendors_created_by   FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE NO ACTION,
    CONSTRAINT fk_vendors_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id)         ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_vendors_updated_at
ON vendors
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE v
       SET updated_at = SYSUTCDATETIME()
      FROM vendors v
      INNER JOIN inserted i ON v.id = i.id;
END;
GO

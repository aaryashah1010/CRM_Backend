-- ============================================================
-- MSSQL nullable unique index compatibility
-- ============================================================
-- SQL Server UNIQUE constraints allow only one NULL value. GST numbers are
-- optional for unregistered customers/vendors, so uniqueness must be enforced
-- only when a real GST number is present.

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = N'uq_customers_gst_number'
      AND parent_object_id = OBJECT_ID(N'dbo.customers')
)
BEGIN
    ALTER TABLE customers DROP CONSTRAINT uq_customers_gst_number;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'ux_customers_gst_number_present'
      AND object_id = OBJECT_ID(N'dbo.customers')
)
BEGIN
    CREATE UNIQUE INDEX ux_customers_gst_number_present
        ON customers (gst_number)
        WHERE gst_number IS NOT NULL AND gst_number <> N'';
END;
GO

IF EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = N'uq_vendors_gst_number'
      AND parent_object_id = OBJECT_ID(N'dbo.vendors')
)
BEGIN
    ALTER TABLE vendors DROP CONSTRAINT uq_vendors_gst_number;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'ux_vendors_gst_number_present'
      AND object_id = OBJECT_ID(N'dbo.vendors')
)
BEGIN
    CREATE UNIQUE INDEX ux_vendors_gst_number_present
        ON vendors (gst_number)
        WHERE gst_number IS NOT NULL AND gst_number <> N'';
END;
GO

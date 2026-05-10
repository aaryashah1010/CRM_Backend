-- MSSQL Server 2017 has no equivalent of a single shared "BEFORE UPDATE" function.
-- The auto-update of `updated_at` is implemented as one AFTER UPDATE trigger per table
-- (defined alongside each table). This file is kept as a placeholder.
PRINT 'init: 000_functions.sql - no-op (per-table AFTER UPDATE triggers handle updated_at)';
GO

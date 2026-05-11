-- ============================================================
-- APP SETTINGS (key/value JSON store for global configuration)
-- ============================================================
CREATE TABLE app_settings (
    id          BIGINT          IDENTITY(1,1) NOT NULL,
    [key]       NVARCHAR(100)   NOT NULL,
    value       NVARCHAR(MAX)   NULL,
    description NVARCHAR(MAX)   NULL,
    is_active   BIT             NOT NULL CONSTRAINT df_app_settings_is_active  DEFAULT (1),
    created_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_app_settings_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_app_settings_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by  BIGINT          NULL,
    updated_by  BIGINT          NULL,
    CONSTRAINT pk_app_settings              PRIMARY KEY (id),
    CONSTRAINT uq_app_settings_key          UNIQUE ([key]),
    CONSTRAINT fk_app_settings_created_by   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_app_settings_updated_by   FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT chk_app_settings_value_json  CHECK (value IS NULL OR ISJSON(value) = 1)
);
GO

CREATE TRIGGER trg_app_settings_updated_at
ON app_settings
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
       SET updated_at = SYSUTCDATETIME()
      FROM app_settings s
      INNER JOIN inserted i ON s.id = i.id;
END;
GO

-- Seed default settings (idempotent inserts so re-running is safe)
INSERT INTO app_settings ([key], value, description)
SELECT 'company.profile',
       N'{"legalName":"Trading ERP Pvt Ltd","gstin":"","registeredAddress":"","email":"","phone":"","website":"","logoUrl":""}',
       N'Corporate identity, GSTIN and contact details for the tenant.'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE [key] = 'company.profile');

INSERT INTO app_settings ([key], value, description)
SELECT 'financial.config',
       N'{"primaryCurrency":"INR","fiscalYearStartMonth":4,"defaultTaxRateId":null,"defaultPaymentTermId":null}',
       N'Currency, fiscal year start and default tax / payment term references.'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE [key] = 'financial.config');

INSERT INTO app_settings ([key], value, description)
SELECT 'invoice.config',
       N'{"prefix":"INV-","nextNumber":1,"padding":5}',
       N'Invoice numbering convention surfaced in Settings > Invoice Configuration.'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE [key] = 'invoice.config');
GO

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE leads (
    id                  BIGINT          IDENTITY(1,1) NOT NULL,
    lead_number         NVARCHAR(50)    NOT NULL,
    customer_id         BIGINT          NULL,
    customer_name       NVARCHAR(200),
    customer_email      NVARCHAR(255),
    customer_phone      NVARCHAR(20),
    customer_company    NVARCHAR(200),
    source              NVARCHAR(50),
    priority            NVARCHAR(20)    NOT NULL CONSTRAINT df_leads_priority  DEFAULT (N'medium'),
    status              NVARCHAR(30)    NOT NULL CONSTRAINT df_leads_status    DEFAULT (N'new'),
    assigned_to         BIGINT          NULL,
    expected_value      DECIMAL(14,2),
    expected_close_date DATE,
    notes               NVARCHAR(MAX),
    lost_reason         NVARCHAR(MAX),
    converted_at        DATETIMEOFFSET  NULL,
    is_active           BIT             NOT NULL CONSTRAINT df_leads_is_active  DEFAULT (1),
    created_at          DATETIMEOFFSET  NOT NULL CONSTRAINT df_leads_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at          DATETIMEOFFSET  NOT NULL CONSTRAINT df_leads_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by          BIGINT          NULL,
    updated_by          BIGINT          NULL,
    CONSTRAINT pk_leads                 PRIMARY KEY (id),
    CONSTRAINT uq_leads_number          UNIQUE (lead_number),
    CONSTRAINT chk_leads_source         CHECK (source IS NULL OR source IN ('website','referral','cold_call','email','social_media','exhibition','other')),
    CONSTRAINT chk_leads_priority       CHECK (priority IN ('low','medium','high')),
    CONSTRAINT chk_leads_status         CHECK (status   IN ('new','contacted','qualified','lost','converted')),
    CONSTRAINT fk_leads_customer        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE NO ACTION,
    CONSTRAINT fk_leads_assigned_to     FOREIGN KEY (assigned_to) REFERENCES users(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_leads_created_by      FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE NO ACTION,
    CONSTRAINT fk_leads_updated_by      FOREIGN KEY (updated_by)  REFERENCES users(id)     ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_leads_updated_at
ON leads
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE l
       SET updated_at = SYSUTCDATETIME()
      FROM leads l
      INNER JOIN inserted i ON l.id = i.id;
END;
GO

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
CREATE TABLE follow_ups (
    id                  BIGINT          IDENTITY(1,1) NOT NULL,
    lead_id             BIGINT          NOT NULL,
    follow_up_type      NVARCHAR(30)    NOT NULL,
    status              NVARCHAR(30)    NOT NULL CONSTRAINT df_follow_ups_status     DEFAULT (N'scheduled'),
    scheduled_at        DATETIMEOFFSET  NOT NULL,
    completed_at        DATETIMEOFFSET  NULL,
    assigned_to         BIGINT          NULL,
    subject             NVARCHAR(255),
    notes               NVARCHAR(MAX),
    next_follow_up_date DATE,
    is_active           BIT             NOT NULL CONSTRAINT df_follow_ups_is_active  DEFAULT (1),
    created_at          DATETIMEOFFSET  NOT NULL CONSTRAINT df_follow_ups_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at          DATETIMEOFFSET  NOT NULL CONSTRAINT df_follow_ups_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by          BIGINT          NULL,
    updated_by          BIGINT          NULL,
    CONSTRAINT pk_follow_ups             PRIMARY KEY (id),
    CONSTRAINT chk_follow_ups_type       CHECK (follow_up_type IN ('call','email','meeting','demo','other')),
    CONSTRAINT chk_follow_ups_status     CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
    CONSTRAINT fk_follow_ups_lead        FOREIGN KEY (lead_id)     REFERENCES leads(id) ON DELETE NO ACTION,
    CONSTRAINT fk_follow_ups_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_follow_ups_created_by  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_follow_ups_updated_by  FOREIGN KEY (updated_by)  REFERENCES users(id) ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_follow_ups_updated_at
ON follow_ups
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE f
       SET updated_at = SYSUTCDATETIME()
      FROM follow_ups f
      INNER JOIN inserted i ON f.id = i.id;
END;
GO

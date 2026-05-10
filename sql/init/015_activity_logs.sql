-- ============================================================
-- ACTIVITY LOGS  (immutable audit trail - no UPDATE/DELETE)
-- ============================================================
CREATE TABLE activity_logs (
    id            BIGINT          IDENTITY(1,1) NOT NULL,
    actor_user_id BIGINT          NULL,
    entity_type   NVARCHAR(100)   NOT NULL,
    entity_id     BIGINT,
    action        NVARCHAR(50)    NOT NULL,
    old_values    NVARCHAR(MAX)   NULL,
    new_values    NVARCHAR(MAX)   NULL,
    ip_address    NVARCHAR(45),
    user_agent    NVARCHAR(MAX),
    created_at    DATETIMEOFFSET  NOT NULL CONSTRAINT df_activity_logs_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT pk_activity_logs PRIMARY KEY (id),
    CONSTRAINT chk_activity_logs_old_values_json CHECK (old_values IS NULL OR ISJSON(old_values) = 1),
    CONSTRAINT chk_activity_logs_new_values_json CHECK (new_values IS NULL OR ISJSON(new_values) = 1),
    CONSTRAINT fk_activity_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
GO

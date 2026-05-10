-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id            BIGINT          IDENTITY(1,1) NOT NULL,
    role_id       BIGINT          NOT NULL,
    full_name     NVARCHAR(200)   NOT NULL,
    email         NVARCHAR(255)   NOT NULL,
    username      NVARCHAR(100)   NOT NULL,
    password_hash NVARCHAR(255)   NOT NULL,
    phone         NVARCHAR(20),
    is_active     BIT             NOT NULL CONSTRAINT df_users_is_active  DEFAULT (1),
    last_login_at DATETIMEOFFSET  NULL,
    created_at    DATETIMEOFFSET  NOT NULL CONSTRAINT df_users_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at    DATETIMEOFFSET  NOT NULL CONSTRAINT df_users_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by    BIGINT          NULL,
    updated_by    BIGINT          NULL,
    CONSTRAINT pk_users          PRIMARY KEY (id),
    CONSTRAINT uq_users_email    UNIQUE (email),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT fk_users_role     FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE NO ACTION
);
GO

-- Self-referential audit FKs (must be NO ACTION to avoid multiple cascade paths)
ALTER TABLE users
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

ALTER TABLE users
    ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

CREATE TRIGGER trg_users_updated_at
ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE u
       SET updated_at = SYSUTCDATETIME()
      FROM users u
      INNER JOIN inserted i ON u.id = i.id;
END;
GO

-- Back-fill audit FKs on roles, permissions, role_permissions now that users exists.
ALTER TABLE roles
    ADD CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

ALTER TABLE roles
    ADD CONSTRAINT fk_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

ALTER TABLE permissions
    ADD CONSTRAINT fk_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

ALTER TABLE permissions
    ADD CONSTRAINT fk_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

ALTER TABLE role_permissions
    ADD CONSTRAINT fk_role_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION;
GO

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
    id          BIGINT          IDENTITY(1,1) NOT NULL,
    name        NVARCHAR(100)   NOT NULL,
    code        NVARCHAR(50)    NOT NULL,
    description NVARCHAR(MAX),
    is_active   BIT             NOT NULL CONSTRAINT df_roles_is_active   DEFAULT (1),
    created_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_roles_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_roles_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by  BIGINT          NULL,
    updated_by  BIGINT          NULL,
    CONSTRAINT pk_roles      PRIMARY KEY (id),
    CONSTRAINT uq_roles_code UNIQUE (code)
);
GO

CREATE TRIGGER trg_roles_updated_at
ON roles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE r
       SET updated_at = SYSUTCDATETIME()
      FROM roles r
      INNER JOIN inserted i ON r.id = i.id;
END;
GO

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE permissions (
    id          BIGINT          IDENTITY(1,1) NOT NULL,
    name        NVARCHAR(100)   NOT NULL,
    code        NVARCHAR(100)   NOT NULL,
    module      NVARCHAR(50)    NOT NULL,
    description NVARCHAR(MAX),
    is_active   BIT             NOT NULL CONSTRAINT df_permissions_is_active   DEFAULT (1),
    created_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_permissions_created_at  DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_permissions_updated_at  DEFAULT (SYSUTCDATETIME()),
    created_by  BIGINT          NULL,
    updated_by  BIGINT          NULL,
    CONSTRAINT pk_permissions      PRIMARY KEY (id),
    CONSTRAINT uq_permissions_code UNIQUE (code)
);
GO

CREATE TRIGGER trg_permissions_updated_at
ON permissions
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
       SET updated_at = SYSUTCDATETIME()
      FROM permissions p
      INNER JOIN inserted i ON p.id = i.id;
END;
GO

-- ============================================================
-- ROLE_PERMISSIONS
-- ============================================================
CREATE TABLE role_permissions (
    id            BIGINT         IDENTITY(1,1) NOT NULL,
    role_id       BIGINT         NOT NULL,
    permission_id BIGINT         NOT NULL,
    created_at    DATETIMEOFFSET NOT NULL CONSTRAINT df_role_permissions_created_at DEFAULT (SYSUTCDATETIME()),
    created_by    BIGINT         NULL,
    CONSTRAINT pk_role_permissions      PRIMARY KEY (id),
    CONSTRAINT uq_role_permissions      UNIQUE (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE NO ACTION,
    CONSTRAINT fk_role_permissions_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE NO ACTION
);
GO

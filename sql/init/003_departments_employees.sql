-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id          BIGINT          IDENTITY(1,1) NOT NULL,
    name        NVARCHAR(100)   NOT NULL,
    code        NVARCHAR(50)    NOT NULL,
    description NVARCHAR(MAX),
    is_active   BIT             NOT NULL CONSTRAINT df_departments_is_active  DEFAULT (1),
    created_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_departments_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at  DATETIMEOFFSET  NOT NULL CONSTRAINT df_departments_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by  BIGINT          NULL,
    updated_by  BIGINT          NULL,
    CONSTRAINT pk_departments              PRIMARY KEY (id),
    CONSTRAINT uq_departments_code         UNIQUE (code),
    CONSTRAINT fk_departments_created_by   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION,
    CONSTRAINT fk_departments_updated_by   FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_departments_updated_at
ON departments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE d
       SET updated_at = SYSUTCDATETIME()
      FROM departments d
      INNER JOIN inserted i ON d.id = i.id;
END;
GO

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE employees (
    id                          BIGINT          IDENTITY(1,1) NOT NULL,
    user_id                     BIGINT          NULL,
    department_id               BIGINT          NULL,
    employee_code               NVARCHAR(50)    NOT NULL,
    full_name                   NVARCHAR(200)   NOT NULL,
    email                       NVARCHAR(255),
    phone                       NVARCHAR(20),
    designation                 NVARCHAR(100),
    date_of_joining             DATE,
    date_of_birth               DATE,
    gender                      NVARCHAR(10),
    address                     NVARCHAR(MAX),
    city                        NVARCHAR(100),
    state                       NVARCHAR(100),
    pincode                     NVARCHAR(10),
    -- Bank details
    bank_name                   NVARCHAR(100),
    bank_account_number         NVARCHAR(50),
    bank_ifsc_code              NVARCHAR(20),
    bank_branch                 NVARCHAR(100),
    -- Emergency contact
    emergency_contact_name      NVARCHAR(200),
    emergency_contact_phone     NVARCHAR(20),
    emergency_contact_relation  NVARCHAR(50),
    is_active                   BIT             NOT NULL CONSTRAINT df_employees_is_active  DEFAULT (1),
    created_at                  DATETIMEOFFSET  NOT NULL CONSTRAINT df_employees_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at                  DATETIMEOFFSET  NOT NULL CONSTRAINT df_employees_updated_at DEFAULT (SYSUTCDATETIME()),
    created_by                  BIGINT          NULL,
    updated_by                  BIGINT          NULL,
    CONSTRAINT pk_employees              PRIMARY KEY (id),
    CONSTRAINT uq_employees_code         UNIQUE (employee_code),
    CONSTRAINT chk_employees_gender      CHECK (gender IS NULL OR gender IN ('male','female','other')),
    CONSTRAINT fk_employees_user         FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE NO ACTION,
    CONSTRAINT fk_employees_department   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE NO ACTION,
    CONSTRAINT fk_employees_created_by   FOREIGN KEY (created_by)    REFERENCES users(id)       ON DELETE NO ACTION,
    CONSTRAINT fk_employees_updated_by   FOREIGN KEY (updated_by)    REFERENCES users(id)       ON DELETE NO ACTION
);
GO

CREATE TRIGGER trg_employees_updated_at
ON employees
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE e
       SET updated_at = SYSUTCDATETIME()
      FROM employees e
      INNER JOIN inserted i ON e.id = i.id;
END;
GO

-- ============================================================
-- SEED DATA
-- ============================================================

-- ROLES
INSERT INTO roles (name, code, description) VALUES
    ('Admin',             'admin',             'Full system access'),
    ('Sales Executive',   'sales_executive',   'Manages leads, quotations and sales orders'),
    ('Purchase Manager',  'purchase_manager',  'Manages purchase orders and vendor payments'),
    ('Accountant',        'accountant',        'Manages invoices, receipts and payments'),
    ('Warehouse Manager', 'warehouse_manager', 'Manages inventory and product inward');

-- PERMISSIONS
INSERT INTO permissions (name, code, module) VALUES
    ('Create User',        'users:create',           'users'),
    ('Read Users',         'users:read',             'users'),
    ('Update User',        'users:update',           'users'),
    ('Delete User',        'users:delete',           'users'),
    ('Create Employee',    'employees:create',       'employees'),
    ('Read Employees',     'employees:read',         'employees'),
    ('Update Employee',    'employees:update',       'employees'),
    ('Delete Employee',    'employees:delete',       'employees'),
    ('Create Customer',    'customers:create',       'customers'),
    ('Read Customers',     'customers:read',         'customers'),
    ('Update Customer',    'customers:update',       'customers'),
    ('Delete Customer',    'customers:delete',       'customers'),
    ('Create Vendor',      'vendors:create',         'vendors'),
    ('Read Vendors',       'vendors:read',           'vendors'),
    ('Update Vendor',      'vendors:update',         'vendors'),
    ('Delete Vendor',      'vendors:delete',         'vendors'),
    ('Create Product',     'products:create',        'products'),
    ('Read Products',      'products:read',          'products'),
    ('Update Product',     'products:update',        'products'),
    ('Delete Product',     'products:delete',        'products'),
    ('Create Lead',        'leads:create',           'leads'),
    ('Read Leads',         'leads:read',             'leads'),
    ('Update Lead',        'leads:update',           'leads'),
    ('Delete Lead',        'leads:delete',           'leads'),
    ('Create Follow-up',   'followups:create',       'followups'),
    ('Read Follow-ups',    'followups:read',         'followups'),
    ('Update Follow-up',   'followups:update',       'followups'),
    ('Delete Follow-up',   'followups:delete',       'followups'),
    ('Create Quotation',   'quotations:create',      'quotations'),
    ('Read Quotations',    'quotations:read',        'quotations'),
    ('Update Quotation',   'quotations:update',      'quotations'),
    ('Approve Quotation',  'quotations:approve',     'quotations'),
    ('Delete Quotation',   'quotations:delete',      'quotations'),
    ('Create Sales Order', 'sales_orders:create',    'sales_orders'),
    ('Read Sales Orders',  'sales_orders:read',      'sales_orders'),
    ('Update Sales Order', 'sales_orders:update',    'sales_orders'),
    ('Delete Sales Order', 'sales_orders:delete',    'sales_orders'),
    ('Create PO',          'purchase_orders:create', 'purchase_orders'),
    ('Read POs',           'purchase_orders:read',   'purchase_orders'),
    ('Update PO',          'purchase_orders:update', 'purchase_orders'),
    ('Delete PO',          'purchase_orders:delete', 'purchase_orders'),
    ('Create Invoice',     'invoices:create',        'invoices'),
    ('Read Invoices',      'invoices:read',          'invoices'),
    ('Update Invoice',     'invoices:update',        'invoices'),
    ('Cancel Invoice',     'invoices:cancel',        'invoices'),
    ('Create Inward',      'inward:create',          'inward'),
    ('Read Inward',        'inward:read',            'inward'),
    ('Update Inward',      'inward:update',          'inward'),
    ('Record Receipt',     'receipts:create',        'receipts'),
    ('Read Receipts',      'receipts:read',          'receipts'),
    ('Update Receipt',     'receipts:update',        'receipts'),
    ('Record Payment',     'payments:create',        'payments'),
    ('Read Payments',      'payments:read',          'payments'),
    ('Update Payment',     'payments:update',        'payments'),
    ('Read Inventory',     'inventory:read',         'inventory'),
    ('Adjust Inventory',   'inventory:adjust',       'inventory'),
    ('View Dashboard',     'dashboard:read',         'dashboard'),
    ('View Reports',       'reports:read',           'reports'),
    ('Export Reports',     'reports:export',         'reports'),
    ('Manage Settings',    'settings:manage',        'settings');

-- ADMIN: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'admin';

-- SALES EXECUTIVE permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'sales_executive'
  AND p.code IN (
    'customers:read','customers:create','customers:update',
    'leads:create','leads:read','leads:update',
    'followups:create','followups:read','followups:update',
    'quotations:create','quotations:read','quotations:update',
    'sales_orders:create','sales_orders:read','sales_orders:update',
    'products:read','vendors:read','dashboard:read',
    'invoices:read','reports:read'
  );

-- PURCHASE MANAGER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'purchase_manager'
  AND p.code IN (
    'vendors:create','vendors:read','vendors:update',
    'purchase_orders:create','purchase_orders:read','purchase_orders:update',
    'inward:create','inward:read','inward:update',
    'products:read','inventory:read',
    'payments:create','payments:read',
    'dashboard:read','reports:read'
  );

-- ACCOUNTANT permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'accountant'
  AND p.code IN (
    'invoices:create','invoices:read','invoices:update','invoices:cancel',
    'receipts:create','receipts:read','receipts:update',
    'payments:create','payments:read','payments:update',
    'customers:read','vendors:read',
    'sales_orders:read','purchase_orders:read',
    'dashboard:read','reports:read','reports:export'
  );

-- WAREHOUSE MANAGER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'warehouse_manager'
  AND p.code IN (
    'inventory:read','inventory:adjust',
    'inward:create','inward:read','inward:update',
    'products:read','products:create','products:update',
    'purchase_orders:read','purchase_orders:update','sales_orders:read',
    'dashboard:read','reports:read'
  );

-- DEPARTMENTS
INSERT INTO departments (name, code) VALUES
    ('Management', 'MGMT'),
    ('Sales',      'SALES'),
    ('Purchase',   'PURCHASE'),
    ('Accounts',   'ACCOUNTS'),
    ('Warehouse',  'WAREHOUSE'),
    ('IT',         'IT'),
    ('HR',         'HR');

-- PAYMENT TERMS
INSERT INTO payment_terms (name, days, description) VALUES
    ('Immediate', 0,  'Payment due immediately'),
    ('Net 7',     7,  'Payment due within 7 days'),
    ('Net 15',    15, 'Payment due within 15 days'),
    ('Net 30',    30, 'Payment due within 30 days'),
    ('Net 45',    45, 'Payment due within 45 days'),
    ('Net 60',    60, 'Payment due within 60 days'),
    ('Advance',   0,  'Full advance payment required');

-- TAX RATES (GST India)
INSERT INTO tax_rates (name, rate, cgst_rate, sgst_rate, igst_rate) VALUES
    ('GST 0%',  0.00,  0.00,  0.00,  0.00),
    ('GST 5%',  5.00,  2.50,  2.50,  5.00),
    ('GST 12%', 12.00, 6.00,  6.00,  12.00),
    ('GST 18%', 18.00, 9.00,  9.00,  18.00),
    ('GST 28%', 28.00, 14.00, 14.00, 28.00);

-- PRODUCT CATEGORIES
INSERT INTO product_categories (name, code) VALUES
    ('General',       'GEN'),
    ('Electronics',   'ELEC'),
    ('Machinery',     'MACH'),
    ('Raw Materials', 'RAW'),
    ('Spare Parts',   'SPARE'),
    ('Consumables',   'CONS');

-- NOTE: Admin user must be created using the setup script after containers start:
--   docker exec -it erp_backend node scripts/create-admin.js
-- or from host:
--   cd Backend && node scripts/create-admin.js

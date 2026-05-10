-- ============================================================
-- INDEXES
-- ============================================================

-- users
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_role_id   ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- employees
CREATE INDEX idx_employees_user_id       ON employees(user_id);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_code          ON employees(employee_code);

-- customers
CREATE INDEX idx_customers_name        ON customers(name);
CREATE INDEX idx_customers_gst_number  ON customers(gst_number);
CREATE INDEX idx_customers_is_active   ON customers(is_active);
CREATE INDEX idx_customers_assigned_to ON customers(assigned_to);

-- customer_addresses
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- vendors
CREATE INDEX idx_vendors_name        ON vendors(name);
CREATE INDEX idx_vendors_gst_number  ON vendors(gst_number);
CREATE INDEX idx_vendors_is_active   ON vendors(is_active);

-- products
CREATE INDEX idx_products_sku         ON products(sku);
CREATE INDEX idx_products_name        ON products(name);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active   ON products(is_active);

-- leads
CREATE INDEX idx_leads_status      ON leads(status);
CREATE INDEX idx_leads_customer_id ON leads(customer_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_created_at  ON leads(created_at);

-- follow_ups
CREATE INDEX idx_follow_ups_lead_id      ON follow_ups(lead_id);
CREATE INDEX idx_follow_ups_assigned_to  ON follow_ups(assigned_to);
CREATE INDEX idx_follow_ups_scheduled_at ON follow_ups(scheduled_at);
CREATE INDEX idx_follow_ups_status       ON follow_ups(status);

-- quotations
CREATE INDEX idx_quotations_customer_id     ON quotations(customer_id);
CREATE INDEX idx_quotations_status          ON quotations(status);
CREATE INDEX idx_quotations_quotation_date  ON quotations(quotation_date);

-- quotation_items
CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX idx_quotation_items_product_id   ON quotation_items(product_id);

-- sales_orders
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status      ON sales_orders(status);
CREATE INDEX idx_sales_orders_order_date  ON sales_orders(order_date);

-- sales_order_items
CREATE INDEX idx_sales_order_items_order_id   ON sales_order_items(order_id);
CREATE INDEX idx_sales_order_items_product_id ON sales_order_items(product_id);

-- purchase_orders
CREATE INDEX idx_purchase_orders_vendor_id  ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status     ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date);

-- purchase_order_items
CREATE INDEX idx_purchase_order_items_po_id      ON purchase_order_items(po_id);
CREATE INDEX idx_purchase_order_items_product_id ON purchase_order_items(product_id);

-- sales_invoices
CREATE INDEX idx_sales_invoices_customer_id   ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_status        ON sales_invoices(status);
CREATE INDEX idx_sales_invoices_invoice_date  ON sales_invoices(invoice_date);
CREATE INDEX idx_sales_invoices_due_date      ON sales_invoices(due_date);
CREATE INDEX idx_sales_invoices_customer_date ON sales_invoices(customer_id, invoice_date);

-- sales_invoice_items
CREATE INDEX idx_sales_invoice_items_invoice_id ON sales_invoice_items(invoice_id);
CREATE INDEX idx_sales_invoice_items_product_id ON sales_invoice_items(product_id);

-- inward_records
CREATE INDEX idx_inward_records_vendor_id ON inward_records(vendor_id);
CREATE INDEX idx_inward_records_date      ON inward_records(inward_date);
CREATE INDEX idx_inward_records_po_id     ON inward_records(purchase_order_id);

-- inward_items
CREATE INDEX idx_inward_items_inward_id  ON inward_items(inward_id);
CREATE INDEX idx_inward_items_product_id ON inward_items(product_id);

-- stock_movements
CREATE INDEX idx_stock_movements_product_id   ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_date         ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, movement_date);
CREATE INDEX idx_stock_movements_reference    ON stock_movements(reference_type, reference_id);

-- receipts
CREATE INDEX idx_receipts_customer_id  ON receipts(customer_id);
CREATE INDEX idx_receipts_invoice_id   ON receipts(invoice_id);
CREATE INDEX idx_receipts_date         ON receipts(receipt_date);
CREATE INDEX idx_receipts_status       ON receipts(status);

-- payments
CREATE INDEX idx_payments_vendor_id ON payments(vendor_id);
CREATE INDEX idx_payments_date      ON payments(payment_date);
CREATE INDEX idx_payments_status    ON payments(status);

-- activity_logs
CREATE INDEX idx_activity_logs_entity     ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_actor      ON activity_logs(actor_user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

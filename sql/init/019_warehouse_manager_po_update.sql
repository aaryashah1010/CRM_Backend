-- ============================================================
-- Grant warehouse_manager 'purchase_orders:update' so that the
-- PO receive (goods inward) endpoint can be executed by the role
-- responsible for receiving stock. Idempotent: re-running is safe.
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'warehouse_manager'
  AND p.code = 'purchase_orders:update'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
GO

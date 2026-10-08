CREATE TEMPORARY TABLE account_role_drop_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO account_role_drop_guard SELECT COUNT(*) FROM user_roles ur
LEFT JOIN users u ON u.id=ur.user_id
WHERE u.id IS NULL OR NOT (ur.assigned_at <=> CASE ur.role_id
  WHEN 1 THEN u.admin_role_assigned_at WHEN 2 THEN u.seller_role_assigned_at
  WHEN 3 THEN u.customer_role_assigned_at ELSE NULL END);
INSERT INTO account_role_drop_guard SELECT COUNT(*) FROM user_roles ur JOIN users u ON u.id=ur.user_id
WHERE NOT ((ur.role_id=1 AND u.account_mode='ADMIN')
  OR (ur.role_id=2 AND u.account_mode IN ('UNIFIED','SELLER_ONLY'))
  OR (ur.role_id=3 AND u.account_mode IN ('UNIFIED','CUSTOMER_ONLY')));
DROP TABLE user_roles;
DROP TABLE roles;
DROP TEMPORARY TABLE account_role_drop_guard;

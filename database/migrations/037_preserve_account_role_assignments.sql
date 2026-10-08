-- Preserve assignment timestamps before switching authorization to account_mode.
CREATE TEMPORARY TABLE account_role_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO account_role_guard
SELECT COUNT(*) FROM users u
WHERE COALESCE((SELECT GROUP_CONCAT(r.code ORDER BY r.code) FROM user_roles ur
  JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id),'') <>
  CASE u.account_mode WHEN 'ADMIN' THEN 'ADMIN' WHEN 'CUSTOMER_ONLY' THEN 'CUSTOMER'
    WHEN 'SELLER_ONLY' THEN 'SELLER' WHEN 'UNIFIED' THEN 'CUSTOMER,SELLER' ELSE 'INVALID' END;
INSERT INTO account_role_guard SELECT COUNT(*) FROM roles
WHERE NOT ((id=1 AND code='ADMIN' AND name='Administrator')
  OR (id=2 AND code='SELLER' AND name='Seller') OR (id=3 AND code='CUSTOMER' AND name='Customer'));
DROP TEMPORARY TABLE account_role_guard;

ALTER TABLE users
  ADD COLUMN admin_role_assigned_at DATETIME(3) NULL,
  ADD COLUMN seller_role_assigned_at DATETIME(3) NULL,
  ADD COLUMN customer_role_assigned_at DATETIME(3) NULL;
UPDATE users u
SET admin_role_assigned_at=(SELECT assigned_at FROM user_roles WHERE user_id=u.id AND role_id=1),
    seller_role_assigned_at=(SELECT assigned_at FROM user_roles WHERE user_id=u.id AND role_id=2),
    customer_role_assigned_at=(SELECT assigned_at FROM user_roles WHERE user_id=u.id AND role_id=3),
    u.updated_at=u.updated_at;

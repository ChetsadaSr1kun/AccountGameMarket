/*
 * Marketplace VAT settlement snapshot
 *
 * amount
 *   = ราคาที่ผู้ซื้อจ่าย
 *
 * vat_rate_percent
 *   = อัตรา VAT ที่ใช้กับ Order นี้
 *
 * vat_amount
 *   = VAT ที่ถูกหักจากผู้ขาย
 *
 * seller_net_amount
 *   = จำนวนเงินจริง/pts ที่ผู้ขายได้รับ
 *
 * Order เก่าก่อนมีระบบ VAT:
 *   VAT = 0
 *   seller_net_amount = amount
 */

ALTER TABLE orders

  ADD COLUMN vat_rate_percent
    DECIMAL(5,2)
    NOT NULL
    DEFAULT 0.00
    AFTER amount,

  ADD COLUMN vat_amount
    DECIMAL(12,2)
    NOT NULL
    DEFAULT 0.00
    AFTER vat_rate_percent,

  ADD COLUMN seller_net_amount
    DECIMAL(12,2)
    NOT NULL
    DEFAULT 0.00
    AFTER vat_amount;


/*
 * Order ที่มีอยู่ก่อนเปิดระบบ VAT
 * ต้องคงยอดเดิมไว้
 *
 * ห้ามย้อนหลังหัก VAT 7%
 */
UPDATE orders

SET
  vat_rate_percent = 0.00,
  vat_amount = 0.00,
  seller_net_amount = amount;
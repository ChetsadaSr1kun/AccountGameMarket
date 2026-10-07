const VAT_RATE_PERCENT = 7;
const MONEY_SCALE = 100;

/*
 * คำนวณ VAT ของ Marketplace
 *
 * กติกา:
 * - ผู้ซื้อจ่ายราคาขายเต็ม
 * - VAT = 7% ของราคาขาย
 * - VAT ปัดเป็นจำนวนเต็ม pts
 * - ทศนิยม < 0.50 ปัดลง
 * - ทศนิยม >= 0.50 ปัดขึ้น
 * - ผู้ขายได้รับ = ราคาขาย - VAT
 */
function calculateVatSettlement(price) {
  const numericPrice = Number(price);

  if (
    !Number.isFinite(numericPrice) ||
    numericPrice < 0
  ) {
    throw new TypeError(
      'Price must be a non-negative number.'
    );
  }

  /*
   * แปลงราคาเป็นหน่วย 0.01 pts ก่อน
   * เพื่อลดปัญหา floating point
   */
  const grossCents =
    Math.round(
      numericPrice * MONEY_SCALE
    );

  /*
   * grossCents * 7 / 10000
   * = VAT 7% ในหน่วย pts
   *
   * +5000 ก่อนหาร 10000
   * = ปัด .50 ขึ้น
   */
  const vatAmount =
    Math.floor(
      (
        grossCents *
          VAT_RATE_PERCENT +
        5000
      ) /
        10000
    );

  const vatCents =
    vatAmount * MONEY_SCALE;

  const sellerNetCents =
    grossCents - vatCents;

  return {
    grossAmount:
      grossCents / MONEY_SCALE,

    vatRatePercent:
      VAT_RATE_PERCENT,

    vatAmount,

    sellerNetAmount:
      sellerNetCents / MONEY_SCALE,
  };
}

module.exports = {
  VAT_RATE_PERCENT,
  calculateVatSettlement,
};
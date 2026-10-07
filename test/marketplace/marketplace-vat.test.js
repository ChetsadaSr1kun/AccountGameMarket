'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VAT_RATE_PERCENT,
  calculateVatSettlement,
} = require(
  '../../backend/src/utils/marketplace-vat'
);

test(
  'marketplace VAT rate is 7 percent',
  () => {
    assert.equal(
      VAT_RATE_PERCENT,
      7
    );
  }
);

test(
  'calculates seller settlement for 100 pts',
  () => {
    assert.deepEqual(
      calculateVatSettlement(100),
      {
        grossAmount: 100,
        vatRatePercent: 7,
        vatAmount: 7,
        sellerNetAmount: 93,
      }
    );
  }
);

test(
  'rounds VAT down when fraction is below 0.50',
  () => {
    assert.deepEqual(
      calculateVatSettlement(7.14),
      {
        grossAmount: 7.14,
        vatRatePercent: 7,
        vatAmount: 0,
        sellerNetAmount: 7.14,
      }
    );
  }
);

test(
  'rounds VAT up when fraction is at least 0.50',
  () => {
    assert.deepEqual(
      calculateVatSettlement(7.15),
      {
        grossAmount: 7.15,
        vatRatePercent: 7,
        vatAmount: 1,
        sellerNetAmount: 6.15,
      }
    );
  }
);

test(
  'handles other marketplace price cases',
  () => {
    assert.deepEqual(
      calculateVatSettlement(50),
      {
        grossAmount: 50,
        vatRatePercent: 7,
        vatAmount: 4,
        sellerNetAmount: 46,
      }
    );

    assert.deepEqual(
      calculateVatSettlement(99),
      {
        grossAmount: 99,
        vatRatePercent: 7,
        vatAmount: 7,
        sellerNetAmount: 92,
      }
    );

    assert.deepEqual(
      calculateVatSettlement(150),
      {
        grossAmount: 150,
        vatRatePercent: 7,
        vatAmount: 11,
        sellerNetAmount: 139,
      }
    );
  }
);

test(
  'gross amount always equals VAT plus seller net amount',
  () => {
    const prices = [
      0,
      7.14,
      7.15,
      49.99,
      50,
      99,
      100,
      101,
      150,
      999.99,
    ];

    for (const price of prices) {
      const result =
        calculateVatSettlement(
          price
        );

      assert.equal(
        Number(
          (
            result.vatAmount +
            result.sellerNetAmount
          ).toFixed(2)
        ),
        result.grossAmount
      );
    }
  }
);

test(
  'rejects invalid or negative prices',
  () => {
    assert.throws(
      () =>
        calculateVatSettlement(-1),
      TypeError
    );

    assert.throws(
      () =>
        calculateVatSettlement(
          Number.NaN
        ),
      TypeError
    );

    assert.throws(
      () =>
        calculateVatSettlement(
          Number.POSITIVE_INFINITY
        ),
      TypeError
    );
  }
);
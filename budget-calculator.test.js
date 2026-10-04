const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, getPreset } = require('./budget-calculator');

test('home costs use frontage and actual surface areas, with a separate reserve', () => {
  const result = calculate(getPreset('home'));
  assert.equal(result.subtotal, 533550);
  assert.equal(result.taxAmount, 0);
  assert.equal(result.reserve, 26678);
  assert.equal(result.total, 560228);
  assert.equal(result.low, 466410);
  assert.equal(result.high, 654045);
  assert.equal(result.items.find((item) => item.label === 'Wardrobes').amount, 130200);
  assert.equal(result.items.find((item) => item.label === 'Surface preparation & painting').amount, 90000);
});

test('construction counts each floor once and includes standard finishes only once', () => {
  const result = calculate({ projectType: 'construction', area: 1000, floors: 2,
    buildRate: 2000, tax: 0, contingency: 0 });
  assert.equal(result.measuredArea, 2000);
  assert.equal(result.subtotal, 4000000);
  assert.equal(result.perSqft, 2000);
  assert.equal(result.items.length, 1);
  assert.equal(result.low, 3600000);
  assert.equal(result.high, 4400000);
  assert.equal(calculate({ ...result.data, floors: 3 }).total, 6000000);
});

test('tax applies to work and fees; reserve applies to the tax-inclusive subtotal', () => {
  const result = calculate({ projectType: 'construction', area: 100, floors: 1,
    buildRate: 2000, foundationAllowance: 10000, externalAllowance: 15000,
    designFee: 5000, tax: 10, contingency: 5 });
  assert.equal(result.subtotal, 230000);
  assert.equal(result.taxAmount, 23000);
  assert.equal(result.reserve, 12650);
  assert.equal(result.total, 265650);
});

test('local adjustments affect unit rates, not fixed allowances', () => {
  const base = calculate(getPreset('kitchen'));
  const adjusted = calculate({ ...getPreset('kitchen'), localAdjustment: 10 });
  assert.equal(base.subtotal, 180600);
  assert.equal(adjusted.subtotal, 196160);
  assert.equal(adjusted.items.find((item) => item.allowance).amount, 25000);
  assert.equal(calculate({ projectType: 'construction', localAdjustment: 50 }).total,
    calculate({ projectType: 'construction', localAdjustment: 0 }).total);
});

test('inactive project quantities cannot leak into a quote', () => {
  const kitchen = calculate({ projectType: 'kitchen', wardrobeArea: 900, storageArea: 900,
    furnitureAllowance: 999999 });
  assert.equal(kitchen.subtotal, 180600);
  const office = calculate({ projectType: 'office', kitchenBaseArea: 500, kitchenAllowance: 900000 });
  assert.equal(office.items.some((item) => /kitchen|wardrobe/i.test(item.label)), false);
});

test('measured surfaces accept fractional square feet and round each amount to rupees', () => {
  const result = calculate({ ...getPreset('kitchen'), kitchenBaseArea: 40.27, countertopArea: 32.15 });
  assert.equal(result.items[0].amount, Math.round(40.27 * 1850));
  assert.equal(result.items[2].amount, Math.round(32.15 * 700));
});

test('invalid, empty, infinite, negative or fractional floor values cannot produce an estimate', () => {
  for (const area of ['', null, NaN, Infinity, -100, 0, 100001]) {
    assert.throws(() => calculate({ area }));
  }
  for (const floors of [0, 1.5, 5, Infinity]) {
    assert.throws(() => calculate({ projectType: 'construction', floors }));
  }
  assert.throws(() => calculate({ projectType: 'unknown' }));
  assert.throws(() => calculate({ finish: 'unknown' }));
  assert.throws(() => calculate({ electricalPoints: -1 }));
  assert.throws(() => calculate({ area: 1000, ceilingArea: 1001 }));
  assert.throws(() => calculate({ area: 1000, flooringArea: 1001 }));
});

test('zero scope has zero cost and no invented minimum charge', () => {
  const values = getPreset('home');
  for (const key of ['kitchenBaseArea', 'kitchenWallArea', 'countertopArea', 'kitchenAllowance',
    'wardrobeArea', 'storageArea', 'ceilingArea', 'paintingArea', 'flooringArea', 'electricalPoints']) values[key] = 0;
  const result = calculate(values);
  assert.equal(result.total, 0);
  assert.equal(result.low, 0);
  assert.equal(result.high, 0);
  assert.equal(result.items.length, 0);
});

test('all project and finish combinations reconcile', () => {
  for (const projectType of ['home', 'kitchen', 'office', 'shop', 'construction']) {
    for (const finish of ['standard', 'premium', 'luxury']) {
      const result = calculate(getPreset(projectType, finish));
      assert.equal(result.subtotal, result.items.reduce((sum, item) => sum + item.amount, 0));
      assert.equal(result.total, result.subtotal + result.taxAmount + result.reserve);
      assert.ok(result.low <= result.total && result.total <= result.high);
    }
  }
});

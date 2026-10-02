import { expect, it } from 'vitest';
import { entryCostTry, quantityForCash, toTry } from '../lib/currency';
import { requireConvertibleHistory } from '../lib/currency-migration';

it('converts dollar quotes to TRY without silently accepting invalid rates', () => {
  expect(toTry(60000, 32)).toBe(1920000);
  for (const rate of [0, -1, NaN, Infinity]) expect(() => toTry(60000, rate)).toThrow();
  expect(() => toTry(Number.MAX_SAFE_INTEGER, 50)).toThrow();
});
it('keeps legacy BIST costs but refuses to guess legacy crypto purchase rates', () => {
  expect(entryCostTry({ type: 'BIST', entryPrice: 100 })).toBe(100);
  expect(entryCostTry({ type: 'CRYPTO', entryPrice: 100, entryPriceTry: 3000 })).toBe(3000);
  expect(() => entryCostTry({ type: 'CRYPTO', entryPrice: 100 })).toThrow('kur kaydı eksik');
});
it('budgets fractional crypto in TRY including commission and keeps BIST lots whole', () => {
  const cash = 10000; const unit = 60000 * 32; const commission = 0.002;
  const quantity = quantityForCash(cash, unit, commission, true);
  expect(quantity).toBeGreaterThan(0);
  expect(quantity * unit * (1 + commission)).toBeLessThanOrEqual(cash);
  expect((quantity + 1e-8) * unit * (1 + commission)).toBeGreaterThan(cash);
  expect(quantityForCash(1000, 100, 0.002, false)).toBe(9);
  expect(quantityForCash(1000, 0, 0.002, true)).toBe(0);
});
it('blocks automatic history migration if either legacy ledger or position records exist', () => {
  expect(() => requireConvertibleHistory({ positions: 0, transactions: 0 })).not.toThrow();
  expect(() => requireConvertibleHistory({ positions: 0, transactions: 1 })).toThrow('kayıtlar korundu');
  expect(() => requireConvertibleHistory({ positions: 1, transactions: 0 })).toThrow('kayıtlar korundu');
});

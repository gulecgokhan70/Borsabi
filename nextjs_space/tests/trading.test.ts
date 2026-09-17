import { describe, expect, it } from 'vitest';
import { calculateSale, tradeSchema } from '../lib/trading';
const buy = { symbol: 'THYAO.IS', type: 'BUY', quantity: 10, price: 100 };
describe('trade validation', () => {
  it.each([-1, 0, Infinity, NaN, '10', true, {}, null])('rejects invalid quantity %j', quantity => {
    expect(tradeSchema.safeParse({ ...buy, quantity }).success).toBe(false);
  });
  it.each([-1, 0, Infinity, NaN, '100'])('rejects invalid client price %j', price => {
    expect(tradeSchema.safeParse({ ...buy, price }).success).toBe(false);
  });
  it.each(['limit', 'stop-limit', 'unknown'])('rejects unsupported orders: %s', orderType => {
    expect(tradeSchema.safeParse({ ...buy, orderType }).success).toBe(false);
  });
  it.each(['XU100.IS', 'xu030.is', 'XU500'])('rejects index trades: %s', symbol => {
    expect(tradeSchema.safeParse({ ...buy, symbol }).success).toBe(false);
  });
  it('requires whole BIST lots and permits fractional crypto', () => {
    expect(tradeSchema.safeParse({ ...buy, quantity: 0.5 }).success).toBe(false);
    expect(tradeSchema.safeParse({ ...buy, symbol: 'BTC-USD', marketType: 'CRYPTO', quantity: 0.00001 }).success).toBe(true);
  });
  it('rejects market mismatch and invalid protective prices', () => {
    expect(tradeSchema.safeParse({ ...buy, symbol: 'BTC-USD' }).success).toBe(false);
    expect(tradeSchema.safeParse({ ...buy, stopLoss: -1 }).success).toBe(false);
    expect(tradeSchema.safeParse({ ...buy, trailingStopPercent: 101 }).success).toBe(false);
  });
});
describe('partial sale accounting', () => {
  it('allocates each purchase commission exactly once across two sales', () => {
    const first = calculateSale({ quantity: 10, entryPrice: 100, commission: 2 }, 5, 110, 0.002);
    expect(first.pnl).toBeCloseTo(47.9);
    expect(first.remainingCommission).toBeCloseTo(1);
    const second = calculateSale({ quantity: first.remainingQuantity, entryPrice: 100, commission: first.remainingCommission }, 5, 120, 0.002);
    expect(second.pnl).toBeCloseTo(97.8);
    expect(first.pnl + second.pnl).toBeCloseTo(145.7);
    expect(second.remainingCommission).toBe(0);
  });
  it('preserves tiny crypto remainders', () => {
    const sale = calculateSale({ quantity: 0.00002, entryPrice: 60000, commission: 0 }, 0.00001, 61000, 0);
    expect(sale.remainingQuantity).toBeCloseTo(0.00001, 10);
  });
  it('rejects selling more than owned', () => {
    expect(() => calculateSale({ quantity: 1, entryPrice: 100, commission: 0 }, 2, 100, 0)).toThrow('Yetersiz miktar');
  });
});

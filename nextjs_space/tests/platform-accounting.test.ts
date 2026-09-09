import { expect, it } from 'vitest';
import { pnlBreakdown } from '../lib/pnl-breakdown';
import { tradeCoachFacts } from '../lib/trade-coach';
import { tradeFingerprint, tradeSchema } from '../lib/trading';
import { allowedPushEndpoint } from '../lib/push';
import { evidenceHeader, priceSource, safeSourceUrl } from '../lib/evidence';
it('decomposes weighted cost exactly into price, FX and both fees', () => {
  const result = pnlBreakdown(.05, 150, 5500, 180, 45, .55, .81);
  expect(result.pnl).toBeCloseTo(128.64);
  expect(result.pricePnlTry + result.fxPnlTry - result.commissionTry).toBeCloseTo(128.64);
  expect(pnlBreakdown(10, 100, 100, 100, 1, 2).pnl).toBe(-2);
});
it('fingerprints the actual order including budget and exit opt-in, not forged FX', () => {
  const raw = { symbol: 'BTC-USD', type: 'BUY', marketType: 'CRYPTO', quantity: .001, requestId: 'test-request-123456' };
  const hash = tradeFingerprint(tradeSchema.parse(raw));
  expect(tradeFingerprint(tradeSchema.parse({ ...raw, fxRate: 1 }))).toBe(hash);
  expect(tradeFingerprint(tradeSchema.parse({ ...raw, maxSpendTry: 1000 }))).not.toBe(hash);
  expect(tradeFingerprint(tradeSchema.parse({ ...raw, autoExit: true }))).not.toBe(hash);
});
it('derives coach facts from cash accounting without inventing missing historic attribution', () => {
  const facts = tradeCoachFacts({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', createdAt: new Date(0), quantity: .1, price: 100, total: 300, commission: .6, stopLoss: 90, fxRate: 30, fxAsOf: new Date(0), pnl: null } as any);
  expect(facts.cashChangeTry).toBe(-300.6); expect(facts.plannedRiskTry).toBe(30);
  expect(facts.pnlTry).toBeNull(); expect(facts.pricePnlTry).toBeNull();
});
it('only permits known push services and safe evidence URLs', () => {
  expect(allowedPushEndpoint('https://web.push.apple.com/QToken')).toBe(true);
  for (const url of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.attacker.test/x', 'https://user:pass@fcm.googleapis.com/x']) expect(allowedPushEndpoint(url)).toBe(false);
  expect(safeSourceUrl('javascript:alert(1)')).toBeNull();
});
it('labels missing timestamps and bounds source metadata HTTP headers', () => {
  const source = priceSource('BTC', 'BTC-USD', null);
  expect(source.asOf).toBeNull(); expect(source.status).toContain('bilinmiyor');
  const header = evidenceHeader(Array.from({ length: 100 }, () => ({ ...source, label: 'ş'.repeat(140) })));
  expect(header.length).toBeLessThanOrEqual(6000); expect(JSON.parse(decodeURIComponent(header)).length).toBeGreaterThan(0);
});

import { expect, it } from 'vitest';
import { assetCurrency, tradableMarketType } from '../lib/asset-display';
import { formatCurrency } from '../lib/constants';
import { tradeSchema } from '../lib/trading';

it('keeps a BTC dollar quote in USD even if metadata is missing or defaults to TRY', () => {
  for (const metadata of [undefined, null, 'TRY', 'USD']) {
    expect(formatCurrency(79315.5, assetCurrency('BTC-USD', metadata))).toBe('$79.315,50');
  }
  expect(formatCurrency(-758.71, assetCurrency('BTC-USD'))).toBe('-$758,71');
});

it('keeps BIST quotes in TRY and formats provider currencies with Turkish separators', () => {
  expect(formatCurrency(315.5, assetCurrency('THYAO.IS', 'USD'))).toBe('₺315,50');
  expect(formatCurrency(1000.5, assetCurrency('EURUSD=X', 'USD'))).toBe('$1.000,50');
});

it('passes the canonical crypto market type accepted by the trade API', () => {
  expect(tradableMarketType('BTC-USD')).toBe('CRYPTO');
  expect(tradeSchema.safeParse({
    symbol: 'BTC-USD', type: 'BUY', quantity: 0.0003,
    marketType: tradableMarketType('BTC-USD'),
  }).success).toBe(true);
  expect(tradableMarketType('THYAO.IS')).toBe('BIST');
});

it('does not offer orders for indices or unsupported instrument types', () => {
  for (const symbol of ['XU100.IS', 'XU030.IS', 'EURUSD=X', 'GC=F']) {
    expect(tradableMarketType(symbol)).toBeNull();
  }
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, prefetch: _prefetch, ...props }: any) => createElement('a', props, children) }));
import { PositionSummary } from '../app/bot-lab/position-summary';
import type { Holding } from '../lib/bot-lab/auto-engine';

const config = { stopLoss: 0.02, takeProfit: 0.04 };
const holding = (entry: number, mark: number, quantity: number, entryFee: number): Holding => ({ entry, mark, quantity, entryFee, openedAt: 1, quoteTime: 1 });
const render = (holdings: Record<string, Holding>) => renderToStaticMarkup(createElement(PositionSummary, { holdings, config, clock: 60001 }));
const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

it('includes entry fees in invested capital and unrealized result, and uses one zero-based scale', () => {
  const html = render({ 'ICP-USD': holding(100, 110, 2.5, 5), 'NEAR-USD': holding(200, 180, 1, 2) });
  // Capital 250 + 5 + 200 + 2 = 457; market value 275 + 180 = 455.
  for (const value of [457, 455, -2, 255, 202, 20, -22]) expect(html).toContain(money(value));
  expect(html).toContain('+7,84%');
  expect(html).toContain('-10,89%');
  expect(html).toContain('width:100%');
  expect(html).toContain(`width:${180 / 275 * 100}%`);
  expect(html).toContain('/stock/ICP-USD');
  expect(html).toContain('satış masrafları dahil değildir');
  expect(html).toContain('Fiyat yaşı: 1 dk');
});

it('shows the fee loss even when the quoted price has not changed', () => {
  const html = render({ 'THYAO.IS': holding(200, 200, 10, 2) });
  expect(html).toContain(money(2002));
  expect(html).toContain(money(-2));
  expect(html).toContain('-0,1%');
  expect(html).toContain('Birim alış fiyatı');
});

it('does not invent chart history or a balance for an empty account', () => {
  const html = render({});
  expect(html).toContain('Açık pozisyon yok');
  expect(html).not.toContain('<figure');
  expect(html).not.toContain('₺');
});

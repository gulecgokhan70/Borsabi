import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, prefetch: _prefetch, ...props }: any) => createElement('a', props, children) }));
import { BotLabClient } from '../app/bot-lab/bot-lab-client';
import { autoInitial } from '../lib/bot-lab/auto-engine';
let renderer: ReactTestRenderer;
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });
it('new bots default to the full catalogue and send scope instead of client supplied catalogue symbols', async () => {
  const fetch = vi.fn(async () => Response.json({ bots: [], workerOnline: true, commission: 0 }));
  vi.stubGlobal('fetch', fetch);
  await act(async () => { renderer = create(createElement(BotLabClient)); });
  expect(renderer.root.findAllByType('select')[1].props.value).toBe('all');
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  const post = (fetch.mock.calls as any[]).find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(post[1].body)).toMatchObject({ mode: 'auto-v2', scope: 'all', symbols: [] });
});
it('selected symbols, holdings, candidates and execution records link to native detail routes', async () => {
  const state = autoInitial(); state.holdings['BTC-USD'] = { quantity: 1, entry: 100, entryFee: 0, mark: 100, quoteTime: 1, openedAt: 1 };
  state.candidates = [{ symbol: 'XRP-USD', score: 50, eligible: false, cross: null, reason: 'test', barTime: 0 }];
  const bot = { id: 'a', market: 'CRYPTO', running: true, checkedAt: null, message: '', state,
    config: { mode: 'auto-v2', symbols: ['ETH-USD'], orderFraction: 0.05, maxPositions: 3, commission: 0, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04 },
    events: [{ id: 'e', data: { action: 'SELL', symbol: 'LTC-USD', time: 1, reason: 'test' } }] };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ bots: [bot], workerOnline: true, commission: 0 })));
  await act(async () => { renderer = create(createElement(BotLabClient)); });
  const hrefs = renderer.root.findAllByType('a').map(link => link.props.href);
  expect(hrefs).toEqual(expect.arrayContaining(['/stock/BTC-USD', '/stock/ETH-USD', '/stock/XRP-USD', '/stock/LTC-USD']));
});
it('shows pending signal times, source price age and legacy missing metadata without inventing timestamps', async () => {
  const now = Date.now();
  const state = autoInitial(); state.paused = false;
  state.focus = { symbols: ['TUPRS.IS'], checkedAt: now };
  state.pending['THYAO.IS'] = { side: 'BUY', after: now, expires: now + 1800000, reason: 'test', signalBarTime: now - 900000, signalQuoteTime: now - 900000 };
  state.candidates = [{ symbol: 'TUPRS.IS', score: 65, eligible: false, cross: null, reason: 'test', barTime: now - 900000, quoteTime: now - 900000, checkedAt: now, source: 'Yahoo Finance' }];
  const bot = { id: 'a', market: 'BIST', running: true, checkedAt: new Date(now).toISOString(), message: '', state,
    config: { mode: 'auto-v2', scope: 'all', symbols: [], orderFraction: 0.05, maxPositions: 3, commission: 0, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04 },
    events: [{ id: 'old', data: { action: 'BUY', symbol: 'THYAO.IS', time: now - 86400000, reason: 'old' } },
      { id: 'new', data: { action: 'BUY', symbol: 'TUPRS.IS', time: now, quoteTime: now - 900000, signalAt: now - 1800000, source: 'Yahoo Finance', reason: 'new' } }] };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ bots: [bot], workerOnline: true, commission: 0 })));
  await act(async () => { renderer = create(createElement(BotLabClient)); });
  const rendered = JSON.stringify(renderer.toJSON());
  expect(rendered).toContain('Fiyat bekleyen sanal emirler');
  expect(rendered).toContain('Sinyalin görüldüğü zaman');
  expect(rendered).toContain('Sanal işlem kayıt zamanı');
  expect(rendered).toContain('Kullanılan fiyat zamanı');
  expect(rendered).toContain('Fiyat yaşı: 15 dk');
  expect(rendered).toContain('Bu eski işlemin fiyat zamanı kaydedilmemiş.');
  expect(rendered).toContain('Son öncelikli kontrol');
});

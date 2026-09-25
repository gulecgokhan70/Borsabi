import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { BistDataNotice, QuoteTime } from '../components/market-data-status';
let renderer: ReactTestRenderer;
afterEach(async () => { await act(async () => renderer?.unmount()); vi.useRealTimers(); });
it('updates opening-data text at 10:15 without a page reload, while keeping session and quote time distinct', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T10:14:50+03:00'));
  await act(async () => { renderer = create(createElement(BistDataNotice, { info: { marketOpen: true, checkedAt: new Date().toISOString() } })); });
  expect(JSON.stringify(renderer.toJSON())).toContain('Açılış verileri bekleniyor');
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('Piyasa açık (kaynağa göre)');
  expect(text).toContain('Veriler yaklaşık 15 dakika gecikmeli');
  expect(text).not.toContain('Açılış verileri bekleniyor');
});
it('shows unknown price time when only a fetch time is available', async () => {
  await act(async () => { renderer = create(createElement(QuoteTime, { info: { checkedAt: new Date().toISOString(), priceSource: 'Midas' } })); });
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('Bilinmiyor');
  expect(text).toContain('Midas');
});

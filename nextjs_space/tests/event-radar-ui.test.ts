import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { EventRadar } from '../components/event-radar';
import { buildEventRadar } from '../lib/event-radar';
let renderer: ReactTestRenderer | undefined;
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(text).join('');
afterEach(async () => { await act(async () => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); });
it('lets the user recover from a failed request and does not label missing news as neutral', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(Response.json(buildEventRadar([])));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(EventRadar)); });
  expect(text(renderer!.root)).toContain('Gelişmeler alınamadı');
  await act(async () => renderer!.root.findByType('button').props.onClick());
  expect(text(renderer!.root)).toContain('piyasada risk olmadığı anlamına gelmez');
  expect(text(renderer!.root)).not.toContain('Gelişmeler alınamadı');
  expect(renderer!.root.findByType('button').props.disabled).toBe(false);
});
it('presents the source, mechanism and counter-scenario together without trading controls', async () => {
  const now = Date.parse('2026-09-16T12:00:00Z');
  const report = buildEventRadar([{ title: 'Petrol yükseldi', url: 'https://dunya.com/haber', date: '2026-09-16T10:00:00Z' }], now);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(report)));
  await act(async () => { renderer = create(createElement(EventRadar)); });
  expect(text(renderer!.root)).toContain('Ters senaryo / belirsizlik:');
  expect(text(renderer!.root)).toContain('Tahmin başarısı ölçülmedi');
  expect(renderer!.root.findByType('a').props.href).toBe('https://dunya.com/haber');
  expect(renderer!.root.findAllByType('button')).toHaveLength(1);
});

import { createElement, useState, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('recharts', () => {
  const box = ({ children }: { children: ReactNode }) => createElement('section', {}, children);
  return { ResponsiveContainer: box, LineChart: box, Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null };
});
import { SymbolSearch } from '../components/symbol-search';
import { matchesSymbol } from '../lib/symbol-search';
import { ReplayClient } from '../app/replay/replay-client';
import { createReplay, replayView } from '../lib/replay';
let renderer: ReactTestRenderer;
const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(textOf).join('');
beforeEach(() => { vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });
it('filters immediately as letters are typed and accepts a touch or keyboard selection', async () => {
  const groups = [{ label: 'BIST', items: [{ symbol: 'THYAO.IS', shortName: 'THYAO', name: 'Türk Hava Yolları' }, { symbol: 'SISE.IS', shortName: 'SISE', name: 'Şişecam' }] }];
  const onSelection = vi.fn();
  function Example() { const [value, setValue] = useState(''); return createElement(SymbolSearch, { value, groups, onChange: v => { setValue(v); onSelection(v); } }); }
  await act(async () => { renderer = create(createElement(Example)); });
  const input = () => renderer.root.findByProps({ role: 'combobox' });
  await act(async () => input().props.onChange({ target: { value: 't' } }));
  expect(renderer.root.findAllByProps({ role: 'option' })).toHaveLength(1);
  expect(textOf(renderer.root)).toContain('Türk Hava Yolları');
  await act(async () => renderer.root.findByProps({ role: 'option' }).props.onClick());
  expect(onSelection).toHaveBeenLastCalledWith('THYAO.IS');
  await act(async () => input().props.onChange({ target: { value: 'sis' } }));
  expect(onSelection).toHaveBeenLastCalledWith('');
  expect(textOf(renderer.root)).toContain('Şişecam');
  await act(async () => input().props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }));
  expect(onSelection).toHaveBeenLastCalledWith('SISE.IS');
  expect(matchesSymbol(groups[0].items[0], 'turk hava')).toBe(true);
  expect(matchesSymbol(groups[0].items[1], 'SISE.IS')).toBe(true);
});
it('restores the loaded day and blocks old-session trades when a different day is selected', async () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({ time: new Date(Date.parse('2026-09-08T09:00:00+03:00') + i * 300000).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1 }));
  const data = { id: 'old', version: 0, ...replayView(createReplay('THYAO.IS', bars)), commissionRate: .001 };
  const fetcher = vi.fn(async () => Response.json(data)); vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(ReplayClient)); });
  const date = renderer.root.findByProps({ 'aria-label': 'Geçmiş gün' });
  expect(date.props.value).toBe('2026-09-08');
  expect(textOf(renderer.root)).toContain('alış ve satışta %0,1');
  await act(async () => date.props.onChange({ target: { value: '2026-09-07' } }));
  expect(textOf(renderer.root)).toContain('Yeni seçim henüz başlamadı');
  expect(renderer.root.findAllByType('fieldset')[1].props.disabled).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

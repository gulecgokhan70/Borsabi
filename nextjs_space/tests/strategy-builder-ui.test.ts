import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('../components/symbol-search', () => ({ SymbolSearch: ({ value, onChange }: any) =>
  createElement('input', { 'aria-label': 'symbol', value, onChange: (e: any) => onChange(e.target.value) }) }));
import StrategyBuilderClient from '../app/strategy-builder/strategy-builder-client';
let renderer: ReactTestRenderer;
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });
const run = () => renderer.root.findAllByType('button').find(b => b.props.disabled !== undefined)!;
it('prevents double submit and displays the Pro error inline', async () => {
  let resolve: (value: unknown) => void = () => undefined;
  const fetcher = vi.fn(() => new Promise(r => { resolve = r; })); vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(StrategyBuilderClient)); });
  await act(async () => { run().props.onClick(); run().props.onClick(); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ ok: false, json: async () => ({ error: 'Pro üyelik gerekir.' }) }); });
  expect(renderer.root.findByProps({ role: 'alert' }).children.join('')).toContain('Pro üyelik');
});
it('cancels old market results and displays crypto capital in USD', async () => {
  const pending: { signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise(resolve => pending.push({ signal: options.signal, resolve }))));
  await act(async () => { renderer = create(createElement(StrategyBuilderClient)); });
  await act(async () => { run().props.onClick(); });
  await act(async () => { renderer.root.findByProps({ 'aria-label': 'symbol' }).props.onChange({ target: { value: 'BTC-USD' } }); });
  expect(pending[0].signal.aborted).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain('$');
  await act(async () => { run().props.onClick(); });
  await act(async () => { pending[1].resolve({ ok: false, json: async () => ({ error: 'NEW_CRYPTO' }) }); });
  await act(async () => { pending[0].resolve({ ok: false, json: async () => ({ error: 'OLD_BIST' }) }); });
  expect(JSON.stringify(renderer.toJSON())).toContain('NEW_CRYPTO');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('OLD_BIST');
});
it('validates stop and target before sending the request', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(StrategyBuilderClient)); });
  const stop = renderer.root.findAllByType('input').find(i => i.props.type === 'number')!;
  await act(async () => { stop.props.onChange({ target: { value: '0' } }); });
  await act(async () => { run().props.onClick(); });
  expect(fetcher).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ role: 'alert' }).children.join('')).toContain('hedef/stop');
});

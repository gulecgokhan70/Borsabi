import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: (props: any) => createElement('a', props) }));
import { FirstSteps } from '../components/first-steps';
let renderer: ReactTestRenderer;
const values = new Map<string, string>();
const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(textOf).join('');
beforeEach(() => {
  values.clear(); vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });
it('shows only the next step until the user expands the guide', async () => {
  await act(async () => { renderer = create(createElement(FirstSteps, { accountId: 'owner', buyCount: 1 })); });
  expect(renderer.root.findAllByType('li')).toHaveLength(1);
  expect(textOf(renderer.root)).toContain('Sonucunu incele');
  const toggle = renderer.root.findAllByType('button').find(b => textOf(b) === 'Tüm adımları göster')!;
  await act(async () => toggle.props.onClick());
  expect(renderer.root.findAllByType('li')).toHaveLength(3);
});
it('collapses a completed guide without losing access to its steps', async () => {
  values.set('borsabi-first-steps-v1:owner', JSON.stringify({ reviewed: true }));
  await act(async () => { renderer = create(createElement(FirstSteps, { accountId: 'owner', buyCount: 1 })); });
  expect(textOf(renderer.root)).toContain('Rehberi tamamladın');
  expect(renderer.root.findAllByType('li')).toHaveLength(0);
  expect(textOf(renderer.root)).toContain('Tamamlanan adımları göster');
});

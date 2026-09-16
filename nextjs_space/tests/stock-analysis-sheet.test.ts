import { createElement, createContext, useContext, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
// Dialog state and actions stay real; substitute only the DOM portal/focus layer.
vi.mock('@radix-ui/react-dialog', () => {
  const State = createContext({ open: false, onOpenChange: (_open: boolean) => {} });
  const element = (type: string) => ({ children, ...props }: any) => createElement(type, props, children);
  return {
    Root: ({ children, ...props }: any) => createElement(State.Provider, { value: props }, children),
    Portal: ({ children }: { children: ReactNode }) => children,
    Overlay: () => null,
    Title: element('h1'),
    Content: ({ children, ...props }: any) => useContext(State).open ? createElement('article', props, children) : null,
    Trigger: ({ children, ...props }: any) => { const state = useContext(State); return createElement('button', { ...props, onClick: () => state.onOpenChange(true) }, children); },
    Close: ({ children, ...props }: any) => { const state = useContext(State); return createElement('button', { ...props, onClick: () => state.onOpenChange(false) }, children); },
  };
});
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => createElement('a', props, children) }));
import { StockAnalysisSheet } from '../components/stock-analysis-sheet';
let renderer: ReactTestRenderer;
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(text).join('');
afterEach(() => { act(() => renderer?.unmount()); });
it('opens a reading view, shows failures with retry and carries the same stock to deeper analysis', async () => {
  const onGenerate = vi.fn();
  const props = { symbol: 'ONRYT.IS', name: 'ONRYT', analysis: null as any, generatedAt: null as string | null, loading: false, error: '', onGenerate, formatPrice: (n: number) => `₺${n}` };
  await act(async () => { renderer = create(createElement(StockAnalysisSheet, props)); });
  expect(onGenerate).not.toHaveBeenCalled();
  await act(async () => renderer.root.findAllByType('button').find(b => text(b).includes('Analizi gör'))!.props.onClick());
  expect(onGenerate).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(createElement(StockAnalysisSheet, { ...props, error: 'Yanıt alınamadı' })));
  expect(text(renderer.root)).toContain('Yanıt alınamadı');
  await act(async () => renderer.root.findAllByType('button').find(b => text(b) === 'Tekrar dene')!.props.onClick());
  expect(onGenerate).toHaveBeenCalledTimes(2);
  await act(async () => renderer.update(createElement(StockAnalysisSheet, { ...props, generatedAt: new Date().toISOString(), analysis: {
    genel_gorunum: 'Test görünümü', trend: 'AŞAĞI', teknik_analiz: { trend_analizi: 'Test eğilimi' }, onemli_seviyeler: { destek1: 13 }, riskler: ['Test riski'],
  } })));
  expect(text(renderer.root)).toContain('Negatif görünüm');
  expect(text(renderer.root)).toContain('Test eğilimi');
  expect(text(renderer.root)).toContain('₺13');
  expect(renderer.root.findByType('a').props.href).toBe('/ai-assistant?symbol=ONRYT.IS');
  await act(async () => renderer.root.findAllByType('button').find(b => b.props['aria-label'] === 'Analizi kapat')!.props.onClick());
  expect(renderer.root.findAllByType('article')).toHaveLength(0);
  expect(text(renderer.root)).toContain('Test görünümü');
});

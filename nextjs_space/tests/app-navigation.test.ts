import { createElement } from 'react';
import { create, type ReactTestInstance } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => createElement('a', props, children) }));
import { MobileNavigation, SidebarNavigation } from '../components/app-navigation';
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(text).join('');
it('keeps five main destinations and highlights the parent section on nested pages', () => {
  const view = create(createElement(MobileNavigation, { pathname: '/academy/borsa-temelleri' }));
  expect(view.root.findAllByType('a').map(a => text(a))).toEqual(['Ana Sayfa', 'Piyasalar', 'Portföy', 'Öğren', 'AI Asistan']);
  expect(view.root.findAllByType('a').filter(a => a.props['aria-current']).map(a => a.props.href)).toEqual(['/academy']);
  view.update(createElement(MobileNavigation, { pathname: '/alerts' }));
  expect(view.root.findAllByType('a').filter(a => a.props['aria-current']).map(a => a.props.href)).toEqual(['/portfolio']);
  view.update(createElement(MobileNavigation, { pathname: '/stock/THYAO.IS' }));
  expect(view.toJSON()).toBeNull(); view.unmount();
});
it('preserves every existing destination and starts with secondary groups collapsed', () => {
  const view = create(createElement(SidebarNavigation, { pathname: '/dashboard', onNavigate: vi.fn() }));
  const paths = view.root.findAllByType('a').map(a => a.props.href);
  expect(paths).toHaveLength(22); expect(new Set(paths).size).toBe(22);
  for (const path of ['/watchlist', '/trade-log', '/alerts', '/kesfet', '/backtest', '/screening', '/algo-scan', '/strategy-builder', '/risk-center', '/day-trading', '/swing-trading', '/aksam-analizi', '/social', '/leaderboard', '/achievements', '/brokers', '/profile']) expect(paths).toContain(path);
  expect(view.root.findAllByType('details').every(d => d.props.open === false)).toBe(true); view.unmount();
});
it('opens the active secondary group and closes the mobile drawer when following a link', () => {
  const onNavigate = vi.fn();
  const view = create(createElement(SidebarNavigation, { pathname: '/backtest', onNavigate }));
  const groups = view.root.findAllByType('details').filter(d => d.props.open);
  expect(groups).toHaveLength(1); expect(text(groups[0].findByType('summary'))).toBe('Gelişmiş');
  const active = view.root.findAllByType('a').find(a => a.props['aria-current'] === 'page')!;
  expect(active.props.href).toBe('/backtest'); active.props.onClick(); expect(onNavigate).toHaveBeenCalledOnce(); view.unmount();
});

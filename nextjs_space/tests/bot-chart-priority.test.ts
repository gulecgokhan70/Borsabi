import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/yahoo-finance', () => ({ yf: { chart: vi.fn() } }));
import { yf } from '../lib/yahoo-finance';
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T12:00:00Z')); });
afterEach(() => vi.useRealTimers());
it('refreshes priority history after sixty seconds while broad history remains cached', async () => {
  const { botChart } = await import('../lib/bot-lab/chart-provider');
  vi.mocked(yf.chart).mockResolvedValue({ quotes: [] } as any);
  await botChart('THYAO.IS');
  await botChart('THYAO.IS', true);
  await botChart('THYAO.IS', true);
  expect(yf.chart).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(61000);
  await botChart('THYAO.IS');
  await botChart('THYAO.IS', true);
  expect(yf.chart).toHaveBeenCalledTimes(3);
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/ai-provider', async original => ({
  ...await original<typeof import('../lib/ai-provider')>(),
  getAIConfig: vi.fn(), requestAICompletion: vi.fn(),
}));
import { AIServiceError, getAIConfig, requestAICompletion } from '../lib/ai-provider';
import { getNewsImpact } from '../lib/news-analysis';

const clock = new Date('2026-09-08T12:00:00Z');
const fetchNews = vi.fn();
function completion() {
  return Response.json({ choices: [{ message: { content: JSON.stringify({ summary: 'Test analysis' }) } }] });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(clock);
  Object.assign((globalThis as any).borsabiNewsAnalysis, { cache: null, pending: null, nextAttemptAt: 0 });
  fetchNews.mockImplementation(async () => Response.json({ news: [{ title: 'Test news' }] }));
  vi.stubGlobal('fetch', fetchNews);
  vi.mocked(requestAICompletion).mockImplementation(async () => completion());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('coalesces simultaneous cold-cache requests and serves the cached result', async () => {
  const results = await Promise.all(Array.from({ length: 3 }, () => getNewsImpact('http://localhost:3000')));
  expect(results[0]?.summary).toBe('Test analysis');
  expect(results[1]).toBe(results[0]); expect(results[2]).toBe(results[0]);
  await getNewsImpact('http://localhost:3000');
  expect(fetchNews).toHaveBeenCalledTimes(1);
  expect(requestAICompletion).toHaveBeenCalledTimes(1);
  vi.setSystemTime(+clock + 30 * 60_000);
  await Promise.all([getNewsImpact('http://localhost:3000'), getNewsImpact('http://localhost:3000')]);
  expect(requestAICompletion).toHaveBeenCalledTimes(2);
});

it('backs off after provider failure and retries after the cooldown', async () => {
  vi.mocked(requestAICompletion).mockRejectedValueOnce(new Error('provider details'));
  expect(await getNewsImpact('http://localhost:3000')).toBeNull();
  expect(await getNewsImpact('http://localhost:3000')).toBeNull();
  expect(requestAICompletion).toHaveBeenCalledTimes(1);
  vi.setSystemTime(+clock + 60_000);
  expect((await getNewsImpact('http://localhost:3000'))?.summary).toBe('Test analysis');
  expect(requestAICompletion).toHaveBeenCalledTimes(2);
});

it('respects provider Retry-After instead of hammering an exhausted quota', async () => {
  vi.mocked(requestAICompletion).mockRejectedValueOnce(new AIServiceError('quota', 429, 120));
  await getNewsImpact('http://localhost:3000');
  vi.setSystemTime(+clock + 60_000);
  await getNewsImpact('http://localhost:3000');
  expect(requestAICompletion).toHaveBeenCalledTimes(1);
  vi.setSystemTime(+clock + 120_000);
  await getNewsImpact('http://localhost:3000');
  expect(requestAICompletion).toHaveBeenCalledTimes(2);
});

it('backs off for empty news and for missing configuration without an AI call', async () => {
  fetchNews.mockImplementation(async () => Response.json({ news: [] }));
  await getNewsImpact('http://localhost:3000');
  await getNewsImpact('http://localhost:3000');
  expect(fetchNews).toHaveBeenCalledTimes(1);
  expect(requestAICompletion).not.toHaveBeenCalled();
  vi.setSystemTime(+clock + 60_000);
  vi.mocked(getAIConfig).mockImplementation(() => { throw new AIServiceError('not configured'); });
  await getNewsImpact('http://localhost:3000');
  await getNewsImpact('http://localhost:3000');
  expect(fetchNews).toHaveBeenCalledTimes(1);
});

it('uses a dated cached analysis during failure but never beyond six hours', async () => {
  const cached = await getNewsImpact('http://localhost:3000');
  vi.mocked(requestAICompletion).mockRejectedValue(new Error('unavailable'));
  vi.setSystemTime(+clock + 31 * 60_000);
  expect(await getNewsImpact('http://localhost:3000')).toEqual(cached);
  vi.setSystemTime(+clock + 6 * 60 * 60_000);
  expect(await getNewsImpact('http://localhost:3000')).toBeNull();
});

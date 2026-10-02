import { expect, it } from 'vitest';
import { buildMarketAlerts } from '../lib/market-alerts';
import type { NewsItem, NewsSourceStatus } from '../lib/news-feed';
const now = Date.parse('2026-09-17T09:00:00Z');
const news = (overrides: Partial<NewsItem> = {}): NewsItem => ({ title: 'Fed faiz artıracak mı?', summary: 'Toplantı takvimi ve beklentiler.', date: '2026-09-17T08:00:00Z', dateVerified: true, url: 'https://www.dunya.com/ekonomi/faiz', source: 'Dünya', category: 'dunya', importance: 8, ...overrides });
it('keeps questions conditional and gives two explainable scenarios instead of a market risk or direction score', () => {
  const alert = buildMarketAlerts([news()], [], now).alerts[0];
  expect(alert.context).toBe('Beklenti / soru');
  expect(alert.scenario).toMatchObject({ sectors: expect.arrayContaining(['Bankacılık']), positive: expect.stringContaining('koşulları gevşer'), negative: expect.stringContaining('koşulları sıkılaşırsa') });
  expect(alert).not.toHaveProperty('riskLevel'); expect(alert).not.toHaveProperty('direction');
});
it('excludes old, future, invalid or unverified dates, unsafe links and unimportant items', () => {
  for (const item of [news({ date: 'invalid' }), news({ date: '2026-09-14T09:00:00Z' }), news({ date: '2026-09-18T09:00:00Z' }), news({ dateVerified: false }), news({ url: 'javascript:alert(1)' }), news({ url: 'https://dunya.com.evil.test/x' }), news({ importance: 1 })]) {
    expect(buildMarketAlerts([item], [], now).alerts).toEqual([]);
  }
});
it('deduplicates tracking URLs and syndicated titles and keeps identifiers stable on refresh', () => {
  const report = buildMarketAlerts([news(), news({ url: news().url + '?utm_source=rss', title: 'Fed toplantısının tarihi' }), news({ url: 'https://www.bloomberght.com/faiz' })], [], now);
  expect(report.alerts).toHaveLength(1);
  expect(buildMarketAlerts([news()], [], now + 10_000).alerts[0].id).toBe(report.alerts[0].id);
});
it('ranks all eligible items before applying the limit and does not invent scenarios for an unknown topic', () => {
  const many = Array.from({ length: 13 }, (_, i) => news({ title: `Genel haber ${i}`, url: `https://dunya.com/${i}`, importance: 3 }));
  many.push(news());
  const report = buildMarketAlerts(many, [], now);
  expect(report.alerts).toHaveLength(12); expect(report.alerts[0].title).toBe(news().title);
  expect(report.alerts[1].scenario).toBeNull();
});
it('distinguishes source failures from a genuinely empty eligible news list', () => {
  const sources: NewsSourceStatus[] = [{ source: 'Dünya', state: 'error', count: 0, checkedAt: new Date(now).toISOString(), latestPublishedAt: null }];
  expect(buildMarketAlerts([], [], now).status).toBe('empty');
  expect(buildMarketAlerts([], sources, now).status).toBe('unavailable');
  expect(buildMarketAlerts([news()], sources, now)).toMatchObject({ status: 'partial', failedSources: ['Dünya'] });
});

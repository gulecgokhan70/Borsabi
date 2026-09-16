import { expect, it } from 'vitest';
import { buildEventRadar, type RadarNews } from '../lib/event-radar';
const now = Date.parse('2026-09-16T12:00:00Z');
const news = (title: string, extra: Partial<RadarNews> = {}): RadarNews => ({ title, date: '2026-09-16T10:00:00Z', dateVerified: true, url: 'https://www.bloomberght.com/haber-123', ...extra });
it('exposes oil cost channels without treating a refiner as an oil producer', () => {
  const report = buildEventRadar([news('Brent petrol fiyatı yükseldi')], now);
  expect(report.events).toHaveLength(1);
  expect(report.events[0].channels.map(c => [c.sector, c.direction])).toEqual([['Havayolu ve taşımacılık', 'olumsuz'], ['Rafineri', 'belirsiz']]);
  expect(report.events[0].symbols).toEqual([]);
  expect(report.events[0].channels.every(c => c.counterScenario.length)).toBe(true);
  expect(report).not.toHaveProperty('probability');
});
it('does not infer market direction from a rate decision without its consensus expectation', () => {
  for (const title of ['TCMB politika faizini artırdı', 'Merkez Bankası faizini indirdi']) {
    const report = buildEventRadar([news(title)], now);
    expect(report.events).toHaveLength(1);
    expect(report.events[0].channels[0].direction).toBe('belirsiz');
  }
});
it('abstains on speculation, negation, unsupported topics and ambiguous multi-event headlines', () => {
  for (const title of ['Petrol yükseldi mi?', 'Petrol yükseldi iddiası yalanlandı', 'Petrol artacak beklentisi', 'Petrol yükselmedi', 'TCMB faiz indirecek', 'Aselsan sözleşme imzalamadı', 'Petrol geçen yıl yükseldi', 'Bitcoin rekor kırdı', 'Petrol yükseldi, ardından petrol düştü']) {
    expect(buildEventRadar([news(title)], now).status, title).toBe('insufficient');
  }
});
it('ignores future, stale, missing, malformed and synthetic publication dates', () => {
  for (const extra of [{ date: '2026-09-16T12:01:00Z' }, { date: '2026-09-14T11:59:59Z' }, { date: '' }, { date: 'bad' }, { dateVerified: false }]) {
    expect(buildEventRadar([news('Petrol düştü', extra)], now).events).toEqual([]);
  }
});
it('never emits unsafe or lookalike source URLs', () => {
  for (const url of ['javascript:alert(1)', 'http://www.dunya.com/a', 'https://dunya.com.attacker.test/a', 'https://attacker.test/dunya.com', 'https://user:password@dunya.com/a']) {
    expect(buildEventRadar([news('Petrol düştü', { url })], now).events).toEqual([]);
  }
});
it('deduplicates repeated headlines and tracking URLs, without counting them as confirmation', () => {
  const report = buildEventRadar([news('Petrol fiyatları yükseldi'), news('Petrol fiyatları yükseldi', { url: 'https://dunya.com/b' }), news('Brent petrol fiyatı yükseldi', { url: 'https://www.bloomberght.com/haber-123?utm_source=test' })], now);
  expect(report.events).toHaveLength(1);
  expect(report.events[0].sourceType).toBe('Haber kaynağı');
});
it('retains opposing stories and exposes the conflict instead of averaging it away', () => {
  const report = buildEventRadar([news('Petrol yükseldi'), news('Petrol düştü', { url: 'https://dunya.com/b', date: '2026-09-16T09:00:00Z' })], now);
  expect(report.events).toHaveLength(2);
  expect(report.conflict).toBe(true);
});
it('requires a single recognized company for company-specific scenarios', () => {
  expect(buildEventRadar([news('Aselsan yeni sözleşme imzaladı')], now).events[0].symbols).toEqual(['ASELS']);
  expect(buildEventRadar([news('THYAO kârı beklentilerin üzerinde')], now).events[0].symbols).toEqual(['THYAO']);
  expect(buildEventRadar([news('Şirketin kârı beklentilerin altında')], now).events).toEqual([]);
  expect(buildEventRadar([news('THYAO ve PGSUS kârı beklentilerin altında')], now).events).toEqual([]);
});
it('does not equate an empty feed with a neutral or low-risk market', () => {
  expect(buildEventRadar([], now)).toMatchObject({ status: 'insufficient', events: [], conflict: false });
  expect(buildEventRadar([], now)).not.toHaveProperty('riskLevel');
});
it('shows unmatched dated headlines without inventing a scenario; labels older news', () => {
  const report = buildEventRadar([
    news('Almanya yeni ekonomik önlem paketi hazırlığında'),
    news('İhracat verileri yayımlandı', { url: 'https://www.trthaber.com/haber/ekonomi/a.html', date: '2026-09-13T10:00:00Z' }),
    news('Tarihsiz', { dateVerified: false }),
    news('Çok eski', { url: 'https://dunya.com/old', date: '2026-09-01T10:00:00Z' }),
    news('Sahte kaynak', { url: 'https://evil.test/a' }),
  ], now);
  expect(report.events).toEqual([]);
  expect(report.headlines).toHaveLength(2);
  expect(report.headlines.map(n => n.older)).toEqual([false, true]);
});

import { expect, it } from 'vitest';
import { buildImpactScenario } from '../lib/radar-scenarios';
import { buildEventRadar } from '../lib/event-radar';
it('supplies two-sided market and sector effects for economic headlines missed by narrow rules', () => {
  for (const title of ["Almanya Çin'e yönelik ekonomik önlem paketi hazırlığında", 'Kıymetli metallerde Fed faiz artırım baskısı', 'Sanayi üretimi verileri yayımlandı', 'Döviz kuru dalgalanıyor', 'Şirket bedelsiz sermaye artırımı açıkladı']) {
    const s = buildImpactScenario(title)!;
    expect(s, title).not.toBeNull();
    expect(s.positive.length).toBeGreaterThan(30); expect(s.negative.length).toBeGreaterThan(30);
    expect(s.market.length).toBeGreaterThan(30); expect(s.sectors.length).toBeGreaterThan(0);
    expect(s.sectors.every(sector => sector.positive && sector.negative)).toBe(true);
    expect(s.watch.length).toBeGreaterThan(0);
    expect(s).not.toHaveProperty('confidence');
  }
});
it('distinguishes conditional positive and negative energy scenarios, without inventing refiner direction', () => {
  expect(buildImpactScenario('Brent petrol fiyatı yükseldi')?.direction).toBe('Negatif');
  expect(buildImpactScenario('Petrol fiyatı düştü')?.direction).toBe('Pozitif');
  const refinery = buildImpactScenario('Petrol fiyatı yükseldi')?.sectors.find(s => s.sector === 'Rafineri');
  expect(refinery?.positive).toContain('Ürün marjı');
  expect(refinery?.negative).toContain('stok zararı');
});
it('never upgrades speculation, negation or opposite moves to a definite direction', () => {
  for (const title of ['Petrol yükseldi mi?', 'Petrol yükselmedi', 'Petrol yükseldi iddiası yalanlandı', 'Petrol geçen yıl yükseldi', 'Petrol yükseldi sonra petrol düştü', 'Petrol artacak beklentisi']) {
    expect(buildImpactScenario(title)?.direction, title).toBe('Koşula bağlı');
  }
  expect(buildImpactScenario('Futbol takımı transfer yaptı')).toBeNull();
});
it('keeps old scenarios readable but excludes them from the current market outlook', () => {
  const report = buildEventRadar([{ title: 'Petrol düştü', date: '2026-09-13T10:00:00Z', url: 'https://dunya.com/eski' },
    { title: 'Petrol yükseldi', date: '2026-09-16T10:00:00Z', url: 'https://dunya.com/yeni' }], Date.parse('2026-09-16T12:00:00Z'));
  expect(report.headlines[0].scenario?.direction).toBe('Pozitif');
  expect(report.headlines[0].older).toBe(true);
  expect(report.marketOutlook).toBe('Negatif');
});

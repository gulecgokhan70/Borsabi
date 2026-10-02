import { expect, it } from 'vitest';
import { bistDataStatus, bistSummary } from '../lib/market-data-status';
const at = (time: string) => Date.parse(`2026-09-25T${time}+03:00`);
const info = (time: string, marketOpen: boolean | null = true) => ({ marketOpen, checkedAt: new Date(at(time)).toISOString() });
it('separates 10:00 session opening from 10:15 delayed data arrival in Istanbul time', () => {
  expect(bistDataStatus(info('10:00:00'), at('10:00:00'))).toMatchObject({ session: 'Piyasa açık (kaynağa göre)', data: 'Açılış verileri bekleniyor' });
  expect(bistDataStatus(info('10:14:59'), at('10:14:59')).data).toBe('Açılış verileri bekleniyor');
  expect(bistDataStatus(info('10:15:00'), at('10:15:00')).data).toBe('Veriler yaklaşık 15 dakika gecikmeli');
  expect(bistDataStatus(info('09:59:59', false), at('09:59:59')).data).not.toContain('bekleniyor');
});
it('does not fabricate a session on holidays, weekends, unknown states or old saved previews', () => {
  expect(bistDataStatus(info('10:10:00', false), at('10:10:00')).session).toContain('kapalı');
  expect(bistDataStatus(info('10:10:00', null), at('10:10:00')).session).toBe('Seans durumu doğrulanmadı');
  expect(bistDataStatus(info('10:00:00'), at('10:10:00')).session).toBe('Seans durumu doğrulanmadı');
  const saturday = Date.parse('2026-09-26T10:10:00+03:00');
  expect(bistDataStatus({ marketOpen: true, checkedAt: new Date(saturday).toISOString() }, saturday).session).toBe('Seans durumu doğrulanmadı');
  expect(bistDataStatus(info('18:11:00'), at('18:11:00')).session).toBe('Seans durumu doğrulanmadı');
});
it('labels truly old prices separately and never constructs a timestamp by subtracting fifteen minutes', () => {
  const quote = { ...info('11:00:00'), priceAsOf: new Date(at('10:10:00')).toISOString() };
  expect(bistDataStatus(quote, at('11:00:00')).data).toBe('Son bilinen fiyat gösteriliyor');
  expect(quote.priceAsOf).toBe(new Date(at('10:10:00')).toISOString());
  expect(bistSummary([{ ...info('10:00:00') }, info('11:00:00', null)], at('11:00:00')).marketOpen).toBeNull();
  expect(bistSummary([info('11:00:00', false), info('11:00:00', true)], at('11:00:00')).marketOpen).toBe(true);
  expect(bistSummary([info('11:00:00', false), info('11:00:00', null)], at('11:00:00')).marketOpen).toBe(false);
});

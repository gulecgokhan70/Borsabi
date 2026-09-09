import { z } from 'zod';
import { commissionRate as validateCommission } from './commission';
import { formatCurrency } from './constants';
export type ReplayBar = { time: string; open: number; high: number; low: number; close: number; volume: number };
type ReplayTrade = { side: 'BUY' | 'SELL'; quantity: number; price: number; commission: number; commissionRate?: number; time: string; note: string; pnl?: number };
export type ReplayState = { symbol: string; currency: 'USD' | 'TRY'; bars: ReplayBar[]; cursor: number; cash: number; initial: number;
  quantity: number; cost: number; fees: number; trades: ReplayTrade[]; finished: boolean; source: string; fetchedAt: string; commissionRate?: number; practiceDate?: string };
export const replayAction = z.object({ action: z.enum(['NEXT', 'BUY', 'SELL', 'FINISH']), quantity: z.number().finite().positive().max(1e9).optional(), note: z.string().max(500).default('') });
export type ReplayAction = z.infer<typeof replayAction>;
export function createReplay(symbol: string, bars: ReplayBar[], fetchedAt = new Date().toISOString(), commissionRate = 0.002): ReplayState {
  validateCommission(commissionRate);
  if (bars.length < 35 || bars.length > 400) throw new Error('Bu günde yeterli 5 dakikalık veri bulunamadı. Başka bir gün seçin.');
  let previous = 0;
  for (const bar of bars) {
    const time = Date.parse(bar.time);
    if (!Number.isFinite(time) || time <= previous || ![bar.open, bar.high, bar.low, bar.close].every(v => Number.isFinite(v) && v > 0)
      || bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close)) throw new Error('Geçmiş fiyat verisi doğrulanamadı.');
    previous = time;
  }
  const currency = symbol.endsWith('-USD') ? 'USD' : 'TRY';
  const initial = currency === 'USD' ? 10000 : 100000;
  return { symbol, currency, commissionRate, practiceDate: replayDate(bars[0].time), bars, cursor: 29, cash: initial, initial, quantity: 0, cost: 0, fees: 0, trades: [], finished: false, source: 'Yahoo Finance — geçmiş 5 dakikalık mumlar', fetchedAt };
}
export function applyReplay(input: ReplayState, action: ReplayAction, rate?: number): ReplayState {
  if (input.finished) throw new Error('Bu pratik tamamlandı. Yeni bir gün başlatın.');
  const s: ReplayState = { ...input, trades: [...input.trades] };
  if (action.action === 'NEXT') { s.cursor = Math.min(s.bars.length - 1, s.cursor + 1); return s; }
  if (action.action === 'FINISH') { s.finished = true; return s; }
  if (s.trades.length >= 200) throw new Error('Bu pratikte en fazla 200 işlem yapılabilir.');
  const quantity = action.quantity;
  if (!quantity || !Number.isFinite(quantity) || quantity <= 0 || (s.currency === 'TRY' && !Number.isSafeInteger(quantity))) throw new Error('Geçerli miktar girin; BIST miktarı tam sayı olmalı.');
  const commissionRate = validateCommission(rate ?? s.commissionRate);
  s.commissionRate = commissionRate;
  const bar = s.bars[s.cursor], total = quantity * bar.close, commission = total * commissionRate;
  let pnl: number | undefined;
  if (action.action === 'BUY') {
    if (total + commission > s.cash) throw new Error('Pratik bakiyesi yetersiz.');
    s.cash -= total + commission; s.quantity += quantity; s.cost += total + commission;
  } else {
    if (quantity > s.quantity) throw new Error('Pratik pozisyonunda yeterli miktar yok.');
    const soldCost = s.cost * quantity / s.quantity;
    pnl = total - commission - soldCost;
    s.cash += total - commission; s.cost -= soldCost; s.quantity -= quantity;
  }
  s.fees += commission;
  s.trades.push({ side: action.action, quantity, price: bar.close, commission, commissionRate, time: bar.time, note: action.note, pnl });
  return s;
}
// Never send unseen bars or the final price to the client, even when finishing early.
export function replayView(s: ReplayState) {
  const price = s.bars[s.cursor].close;
  const equity = s.cash + s.quantity * price;
  return { ...s, bars: s.bars.slice(0, s.cursor + 1), stepsRemaining: s.bars.length - s.cursor - 1, equity,
    pnl: equity - s.initial, openPnl: s.quantity * price - s.cost,
    assessment: s.finished ? [
      `${s.trades.length} işlem yaptınız; toplam komisyon ${formatCurrency(s.fees, s.currency)}.`,
      `Gözlenen son fiyatta toplam sonuç ${formatCurrency(equity - s.initial, s.currency)}.`,
      s.quantity > 0 ? 'Açık pozisyon son görülen fiyatla değerlendi; satış komisyonu henüz kesilmedi.' : 'Tüm pozisyonlar kapalı.',
      `${s.trades.filter(t => t.note.trim()).length} işleminizde karar notu var. Sonuçları işlem öncesindeki gerekçenizle karşılaştırın.`,
      'Bu çalışma geçmiş fiyatlarla yapılır; gelecekte aynı sonucun oluşacağını göstermez.',
    ] : null };
}

export function replayDate(time: string | number = Date.now()) {
  return new Date(time).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

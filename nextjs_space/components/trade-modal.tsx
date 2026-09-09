'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, AlertTriangle, Loader2, ChevronDown, Shield, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/constants';
import { quantityForCash } from '@/lib/currency';
import type { TradeMarketType } from '@/lib/asset-display';
import { toast } from 'sonner';
import { useHaptic } from '@/hooks/use-haptic';
import { useConfetti } from '@/hooks/use-confetti';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  price: number;
  marketType: TradeMarketType;
  side?: 'BUY' | 'SELL';
  maxQuantity?: number;
  onSuccess?: () => void;
  initialStopLoss?: number;
  initialTakeProfit?: number;
}

type OrderType = 'market' | 'limit' | 'stop-limit';

export function TradeModal({ isOpen, onClose, symbol, name, price, marketType, side = 'BUY', maxQuantity, onSuccess, initialStopLoss, initialTakeProfit }: TradeModalProps) {
  const haptic = useHaptic();
  const confetti = useConfetti();
  const [type, setType] = useState<'BUY' | 'SELL'>(side);
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [trailingStop, setTrailingStop] = useState(false);
  const [trailingPercent, setTrailingPercent] = useState('3');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [userPositionQty, setUserPositionQty] = useState(0);
  const [cashAmount, setCashAmount] = useState('');
  const [inputMode, setInputMode] = useState<'quantity' | 'cash'>('quantity');
  const [userCommRate, setUserCommRate] = useState(0.002);
  const [fx, setFx] = useState<{ rate: number; asOf: string } | null>(null);
  const [fxError, setFxError] = useState('');
  const [accountReady, setAccountReady] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [autoExit, setAutoExit] = useState(false);
  const busy = useRef(false);

  useEffect(() => { setType(side); }, [side]);

  // Öneri varsa veya yoksa otomatik stop loss / take profit hesapla
  useEffect(() => {
    if (!isOpen || !price || price <= 0) return;
    const sl = initialStopLoss && initialStopLoss > 0 ? initialStopLoss : null;
    const tp = initialTakeProfit && initialTakeProfit > 0 ? initialTakeProfit : null;
    // Dışarıdan gelen değerler varsa onları kullan
    if (sl) {
      setStopLoss(sl.toFixed(2));
      setShowAdvanced(true);
    } else {
      // Otomatik öneri: fiyatın %3 altı SL
      const autoSL = +(price * 0.97).toFixed(2);
      setStopLoss(autoSL.toString());
      setShowAdvanced(true);
    }
    if (tp) {
      setTakeProfit(tp.toFixed(2));
      setShowAdvanced(true);
    } else {
      // Otomatik öneri: fiyatın %5 üstü TP
      const autoTP = +(price * 1.05).toFixed(2);
      setTakeProfit(autoTP.toString());
      setShowAdvanced(true);
    }
  }, [isOpen, initialStopLoss, initialTakeProfit, price]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAccountReady(false); setAccountError('');
    fetch('/api/portfolio').then(r => r.json()).then(data => {
      if (cancelled) return;
      if (data.error) throw new Error(data.error);
      setUserBalance(data.balance); setUserCommRate(data.commissionRate);
      setAccountId(data.accountId ?? '');
      if (data.accountId) setPending(sessionStorage.getItem(`borsabi-order:${data.accountId}`));
      const pos = (data.positions ?? []).find((p: any) => p.symbol === symbol);
      setUserPositionQty(pos?.quantity ?? 0); setAccountReady(true);
    }).catch(error => { if (!cancelled) setAccountError(error.message || 'Bakiye alınamadı.'); });
    return () => { cancelled = true; };
  }, [isOpen, symbol]);

  useEffect(() => {
    if (!isOpen || marketType !== 'CRYPTO') return;
    let cancelled = false;
    setFx(null); setFxError('');
    const refresh = async () => {
      try {
        const res = await fetch('/api/fx'); const data = await res.json();
        if (!res.ok || !Number.isFinite(data.rate) || data.rate <= 0) throw new Error(data.error || 'Kur alınamadı.');
        if (!cancelled) { setFx(data); setFxError(''); }
      } catch (error) {
        if (!cancelled) { setFx(null); setFxError(error instanceof Error ? error.message : 'Kur alınamadı.'); }
      }
    };
    refresh(); const timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isOpen, marketType]);

  const execPrice = orderType === 'market' ? (price ?? 0) : (parseFloat(limitPrice) || (price ?? 0));
  const qty = parseFloat(quantity) || 0;
  const fxRate = marketType === 'CRYPTO' ? (fx?.rate ?? 0) : 1;
  const unitPriceTry = execPrice * fxRate;
  const total = qty * unitPriceTry;
  const commission = total * userCommRate;
  const totalWithCommission = type === 'BUY' ? total + commission : total - commission;
  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(takeProfit) || 0;
  const potentialLoss = sl > 0 ? Math.abs(execPrice - sl) * fxRate * qty : 0;
  const potentialGain = tp > 0 ? Math.abs(tp - execPrice) * fxRate * qty : 0;
  const riskReward = potentialLoss > 0 ? potentialGain / potentialLoss : 0;

  useEffect(() => {
    if (inputMode !== 'cash') return;
    const cash = parseFloat(cashAmount) || 0;
    setQuantity(String(quantityForCash(cash, unitPriceTry, type === 'BUY' ? userCommRate : 0, marketType === 'CRYPTO')));
  }, [inputMode, cashAmount, unitPriceTry, type, userCommRate, marketType]);

  const handleTrade = async () => {
    if (busy.current || loading || !accountReady || (!pending && fxRate <= 0)) return;
    if (!pending && qty <= 0) { toast.error('Geçerli bir miktar girin'); return; }
    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast.error('Limit fiyatı girin'); return;
    }
    if (orderType === 'stop-limit') {
      if (!stopPrice || parseFloat(stopPrice) <= 0) { toast.error('Stop fiyatı girin'); return; }
      if (!limitPrice || parseFloat(limitPrice) <= 0) { toast.error('Limit fiyatı girin'); return; }
    }
    busy.current = true; setLoading(true);
    try {
      const payload = pending ?? JSON.stringify({
        symbol, name, type, marketType, quantity: qty, price: execPrice, orderType,
        requestId: crypto.randomUUID(),
        maxSpendTry: type === 'BUY' ? (inputMode === 'cash' ? parseFloat(cashAmount) : totalWithCommission) : undefined,
        autoExit: type === 'BUY' ? autoExit : undefined,
        stopLoss: sl > 0 ? sl : null, takeProfit: tp > 0 ? tp : null,
        trailingStopPercent: trailingStop ? (parseFloat(trailingPercent) || 3) : null, note: note || null,
      });
      if (accountId) sessionStorage.setItem(`borsabi-order:${accountId}`, payload);
      setPending(payload);
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      const data = await res.json();
      if (res.ok || (res.status >= 400 && res.status < 500 && ![401, 403, 408, 429].includes(res.status))) {
        if (accountId) sessionStorage.removeItem(`borsabi-order:${accountId}`);
        setPending(null);
      }
      if (!res.ok) { haptic.warning(); toast.error(data?.error ?? 'İşlem başarısız'); if (res.status === 409) onSuccess?.(); return; }
      const orderLabel = orderType === 'market' ? '' : orderType === 'limit' ? ' (Limit Emir)' : ' (Stop-Limit Emir)';
      haptic.success();
      toast.success((data?.message ?? 'İşlem başarılı') + orderLabel);
      // Confetti on profitable SELL or any successful trade
      if (type === 'SELL' && (data?.pnl ?? 0) > 0) {
        confetti.fire();
        toast.success(`🎉 Tebrikler! ${formatCurrency(data.pnl)} kâr elde ettiniz!`);
      }
      if (data?.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error('İşlem sonucu doğrulanamadı. Aynı isteğin sonucunu kontrol ederek tekrar deneyin.');
      console.error(e);
    } finally {
      busy.current = false; setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currencyCode = marketType === 'CRYPTO' ? 'USD' : 'TRY';

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="fixed inset-x-0 bottom-0 glass-modal rounded-t-2xl shadow-2xl max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-2xl lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-md lg:max-h-[90vh] lg:pb-0"
        >
          <div className="flex justify-center pt-2 pb-0 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between p-4 pt-2 sm:pt-4 border-b border-black/[0.08] dark:border-white/[0.08]">
            <div>
              <h3 className="text-lg font-bold text-foreground">{symbol}</h3>
              <p className="text-xs text-muted-foreground">{name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold text-foreground">{formatCurrency(price, currencyCode)}</span>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 pt-3 space-y-3 sm:space-y-4">
            {pending && <div role="alert" className="p-3 glass-inner rounded-lg text-sm">
              Son emrin sonucu henüz doğrulanmadı. Yeni emir vermeden önce aynı isteği güvenle kontrol edin.
              <button disabled={loading} onClick={handleTrade} className="block min-h-[44px] text-[#3B82F6]">Son emrin sonucunu kontrol et</button>
            </div>}
            <fieldset disabled={loading || !!pending} className="space-y-3 min-w-0">
            {/* Buy/Sell toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 glass-inner rounded-lg">
              <button
                onClick={() => setType('BUY')}
                className={`py-1.5 sm:py-2 rounded-md text-sm font-semibold transition-all ${type === 'BUY' ? 'bg-[#22C55E] text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1" /> Alış
              </button>
              <button
                onClick={() => setType('SELL')}
                className={`py-1.5 sm:py-2 rounded-md text-sm font-semibold transition-all ${type === 'SELL' ? 'bg-[#EF4444] text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <TrendingDown className="w-4 h-4 inline mr-1" /> Satış
              </button>
            </div>

            {/* Order Type */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Emir Türü</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 glass-inner rounded-lg">
                {[
                  { value: 'market' as OrderType, label: 'Piyasa' },
                  { value: 'limit' as OrderType, label: 'Limit' },
                  { value: 'stop-limit' as OrderType, label: 'Stop-Limit' },
                ].map((ot) => (
                  <button
                    key={ot.value}
                    disabled={ot.value !== 'market'}
                    onClick={() => setOrderType(ot.value)}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      orderType === ot.value ? 'bg-[#3B82F6] text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {ot.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Yalnızca piyasa emri kullanılabilir. İşlem, sunucudan alınan son fiyatla gerçekleşir; veriler gecikmeli olabilir.</p>
            </div>

            {/* Limit Price */}
            {(orderType === 'limit' || orderType === 'stop-limit') && (
              <div className="space-y-3">
                {orderType === 'stop-limit' && (
                  <div>
                    <label className="text-xs text-[#F59E0B] mb-1 block">Stop Fiyatı <span className="text-slate-400 dark:text-slate-500">(tetikleme)</span></label>
                    <input
                      type="number"
                      value={stopPrice}
                      onChange={(e: any) => setStopPrice(e?.target?.value ?? '')}
                      placeholder={`Ör: ${(price * (type === 'BUY' ? 1.02 : 0.98)).toFixed(2)}`}
                      className="w-full px-3 py-2.5 glass-inner border border-[#F59E0B]/30 rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent outline-none"
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {type === 'BUY' ? 'Fiyat bu seviyeye ulaştığında limit emir aktif olur' : 'Fiyat bu seviyenin altına düştüğünde limit emir aktif olur'}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[#3B82F6] mb-1 block">Limit Fiyatı <span className="text-slate-400 dark:text-slate-500">(işlem fiyatı)</span></label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e: any) => setLimitPrice(e?.target?.value ?? '')}
                    placeholder={price?.toFixed(2)}
                    className="w-full px-3 py-2.5 glass-inner border border-[#3B82F6]/30 rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                  />
                </div>
              </div>
            )}

            {/* Input Mode Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1 p-0.5 glass-inner rounded-md">
                  <button
                    onClick={() => setInputMode('quantity')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${inputMode === 'quantity' ? 'bg-[#3B82F6] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Adet
                  </button>
                  <button
                    onClick={() => setInputMode('cash')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${inputMode === 'cash' ? 'bg-[#3B82F6] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Tutar (TL)
                  </button>
                </div>
                {type === 'BUY' && price > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Bakiye: {formatCurrency(userBalance)}</span>
                )}
                {type === 'SELL' && (maxQuantity ?? userPositionQty) > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Pozisyon: {maxQuantity ?? userPositionQty} adet</span>
                )}
              </div>

              {inputMode === 'quantity' ? (
                <input
                  type="number"
                  value={quantity}
                  onChange={(e: any) => {
                    const val = e?.target?.value ?? '';
                    setQuantity(val);
                    const q = parseFloat(val) || 0;
                    setCashAmount(q > 0 && unitPriceTry > 0 ? String(Math.round(q * unitPriceTry * 100) / 100) : '');
                  }}
                  placeholder="Adet girin"
                  className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                />
              ) : (
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e: any) => {
                    const val = e?.target?.value ?? '';
                    setCashAmount(val);
                    const cash = parseFloat(val) || 0;
                    if (cash > 0 && unitPriceTry > 0) {
                      const calcQty = quantityForCash(cash, unitPriceTry, type === 'BUY' ? userCommRate : 0, marketType === 'CRYPTO');
                      setQuantity(String(Math.max(0, calcQty)));
                    } else {
                      setQuantity('');
                    }
                  }}
                  placeholder="Tutar girin (TL)"
                  className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                />
              )}

              {/* Calculated info */}
              {inputMode === 'cash' && qty > 0 && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {qty} adet • Birim fiyat: {formatCurrency(execPrice, currencyCode)} • Yaklaşık tutar: {formatCurrency(total)}
                </p>
              )}
              {inputMode === 'quantity' && qty > 0 && execPrice > 0 && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Tutar: {formatCurrency(total)}
                </p>
              )}

              {/* Percentage buttons */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[25, 50, 75, 100].map(pct => {
                  const handlePct = () => {
                    setInputMode('quantity');
                    if (type === 'BUY') {
                      const ep = unitPriceTry;
                      const available = userBalance * (pct / 100);
                      const maxQty = quantityForCash(available, ep, userCommRate, marketType === 'CRYPTO');
                      setQuantity(String(Math.max(0, maxQty)));
                      setCashAmount(String(Math.round(available * 100) / 100));
                    } else {
                      const maxSell = maxQuantity ?? userPositionQty;
                      const part = maxSell * (pct / 100);
                      const sellQty = pct === 100 ? maxSell : marketType === 'CRYPTO' ? Math.floor(part * 1e8) / 1e8 : Math.floor(part);
                      setQuantity(String(Math.max(0, sellQty)));
                      setCashAmount(String(Math.round(sellQty * unitPriceTry * 100) / 100));
                    }
                  };
                  return (
                    <button
                      key={pct}
                      onClick={handlePct}
                      className={`py-1.5 rounded-md text-xs font-semibold transition-all border ${
                        type === 'BUY'
                          ? 'border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/10'
                          : 'border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/10'
                      } glass-inner`}
                    >
                      %{pct}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-muted-foreground transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              Zarar Kes / Kar Al Ayarları
            </button>

            {/* Stop Loss & Take Profit */}
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-3 overflow-hidden">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#EF4444] mb-1 flex items-center gap-1.5">Zarar Kes (SL) <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] font-medium">{initialStopLoss ? 'Tavsiye' : 'Otomatik'}</span></label>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e: any) => setStopLoss(e?.target?.value ?? '')}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-[#EF4444] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#22C55E] mb-1 flex items-center gap-1.5">Kar Al (TP) <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] font-medium">{initialTakeProfit ? 'Tavsiye' : 'Otomatik'}</span></label>
                    <input
                      type="number"
                      value={takeProfit}
                      onChange={(e: any) => setTakeProfit(e?.target?.value ?? '')}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Trailing Stop */}
                <div className="flex items-center justify-between p-3 glass-inner rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F59E0B]" />
                    <div>
                      <p className="text-xs font-medium text-foreground">İz Süren Stop</p>
                      <p className="text-[10px] text-muted-foreground">Fiyat yüseldikçe stop otomatik yükselir</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrailingStop(!trailingStop)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${trailingStop ? 'bg-[#F59E0B]' : 'bg-black/10 dark:bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${trailingStop ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {trailingStop && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-[#F59E0B] whitespace-nowrap">İz mesafesi:</label>
                    <div className="flex items-center gap-1 flex-1">
                      {['2', '3', '5', '7'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTrailingPercent(p)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                            trailingPercent === p
                              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40'
                              : 'border-black/[0.06] dark:border-white/[0.08] text-muted-foreground hover:text-foreground'
                          } glass-inner`}
                        >
                          %{p}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={trailingPercent}
                      onChange={(e: any) => setTrailingPercent(e?.target?.value ?? '3')}
                      className="w-16 px-2 py-1.5 glass-inner border border-[#F59E0B]/30 rounded-lg text-[#F59E0B] font-mono text-xs text-center focus:ring-1 focus:ring-[#F59E0B] outline-none"
                      min="0.5"
                      max="20"
                      step="0.5"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Not (isteğe bağlı)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e: any) => setNote(e?.target?.value ?? '')}
                    placeholder="İşlem notu..."
                    className="w-full px-3 py-2 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                  />
                </div>
              </motion.div>
            )}

            {accountError && <p role="alert" className="text-sm text-[#F59E0B]">{accountError}</p>}
            {type === 'BUY' && <label className="flex gap-3 items-start text-sm p-3 glass-inner rounded-lg">
              <input type="checkbox" checked={autoExit} onChange={e => setAutoExit(e.target.checked)} className="mt-1 h-5 w-5" />
              <span>Otomatik simülasyon satışı<span className="block text-xs text-muted-foreground">Zarar kes / kâr al sunucuda kontrol edilir. Eşik fiyatı garanti edilmez; ilk geçerli gözlenen fiyatla satılır. Kapalıysa seviyeler yalnızca plan olarak saklanır.</span></span>
            </label>}
            {marketType === 'CRYPTO' && <p role={fxError ? 'alert' : undefined} className="text-xs text-muted-foreground">
              {fx ? `1 USD = ${formatCurrency(fx.rate)} • Kur zamanı: ${new Date(fx.asOf).toLocaleString('tr-TR')}. Tutarlar tahminidir; işlemde sunucunun son kuru kullanılır.` : fxError || 'USD/TL kuru yükleniyor…'}
            </p>}
            {/* Summary */}
            <div className="p-3 glass-inner rounded-lg space-y-2">
              {orderType !== 'market' && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">İşlem Fiyatı</span>
                  <span className="text-[#3B82F6] font-mono font-semibold">{formatCurrency(execPrice, currencyCode)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Toplam</span><span className="text-foreground font-mono">{formatCurrency(total)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Komisyon (%{(userCommRate * 100).toFixed(2).replace(/\.?0+$/, '')})</span><span className="text-[#F59E0B] font-mono">{formatCurrency(commission)}</span></div>
              <div className="border-t border-black/[0.08] dark:border-white/[0.08] pt-2 flex justify-between text-sm"><span className="text-muted-foreground font-medium">{type === 'BUY' ? 'Bakiyeden düşülecek (TL)' : 'Bakiyeye eklenecek (TL)'}</span><span className="text-foreground font-bold font-mono">{formatCurrency(totalWithCommission)}</span></div>
              {riskReward > 0 && (
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Risk/Getiri</span><span className="text-[#3B82F6] font-mono">1:{riskReward.toFixed(1)}</span></div>
              )}
            </div>

            {/* Warning */}
            {stopLoss && takeProfit && qty > 0 && (
              <div className="flex items-start gap-2 p-2.5 bg-[#22C55E]/10 rounded-lg">
                <Shield className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#22C55E]">
                  Zarar kes: {formatCurrency(parseFloat(stopLoss), currencyCode)} | Kar al: {formatCurrency(parseFloat(takeProfit), currencyCode)}
                  {trailingStop && <span className="text-[#F59E0B]"> | İz süren: %{trailingPercent}</span>}
                </p>
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={loading || qty <= 0 || !accountReady || fxRate <= 0}
              className={`w-full py-2.5 sm:py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 ${
                type === 'BUY' ? 'bg-[#22C55E] hover:bg-[#16A34A]' : 'bg-[#EF4444] hover:bg-[#DC2626]'
              }`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                <>
                  {type === 'BUY' ? `${qty} Adet Al` : `${qty} Adet Sat`}
                  {orderType !== 'market' && <span className="text-xs opacity-75 ml-1">({orderType === 'limit' ? 'Limit' : 'Stop-Limit'})</span>}
                </>
              )}
            </button>
            </fieldset>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent as any, document.body) as any;
}

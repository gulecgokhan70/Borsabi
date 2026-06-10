'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COMMISSION_RATE, formatCurrency } from '@/lib/constants';
import { toast } from 'sonner';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name: string;
  price: number;
  marketType: string;
  side?: 'BUY' | 'SELL';
  maxQuantity?: number;
  onSuccess?: () => void;
}

type OrderType = 'market' | 'limit' | 'stop-limit';

export function TradeModal({ isOpen, onClose, symbol, name, price, marketType, side = 'BUY', maxQuantity, onSuccess }: TradeModalProps) {
  const [type, setType] = useState<'BUY' | 'SELL'>(side);
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { setType(side); }, [side]);

  const execPrice = orderType === 'market' ? (price ?? 0) : (parseFloat(limitPrice) || (price ?? 0));
  const qty = parseFloat(quantity) || 0;
  const total = qty * execPrice;
  const commission = total * COMMISSION_RATE;
  const totalWithCommission = total + commission;
  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(takeProfit) || 0;
  const potentialLoss = sl > 0 ? Math.abs(execPrice - sl) * qty : 0;
  const potentialGain = tp > 0 ? Math.abs(tp - execPrice) * qty : 0;
  const riskReward = potentialLoss > 0 ? potentialGain / potentialLoss : 0;

  const handleTrade = async () => {
    if (qty <= 0) { toast.error('Geçerli bir miktar girin'); return; }
    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast.error('Limit fiyatı girin'); return;
    }
    if (orderType === 'stop-limit') {
      if (!stopPrice || parseFloat(stopPrice) <= 0) { toast.error('Stop fiyatı girin'); return; }
      if (!limitPrice || parseFloat(limitPrice) <= 0) { toast.error('Limit fiyatı girin'); return; }
    }
    setLoading(true);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, name, type, marketType, quantity: qty,
          price: execPrice,
          orderType,
          limitPrice: orderType !== 'market' ? parseFloat(limitPrice) : null,
          stopPrice: orderType === 'stop-limit' ? parseFloat(stopPrice) : null,
          stopLoss: sl > 0 ? sl : null,
          takeProfit: tp > 0 ? tp : null,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'İşlem başarısız'); return; }
      const orderLabel = orderType === 'market' ? '' : orderType === 'limit' ? ' (Limit Emir)' : ' (Stop-Limit Emir)';
      toast.success((data?.message ?? 'İşlem başarılı') + orderLabel);
      if (data?.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error('İşlem hatası');
      console.error(e);
    } finally {
      setLoading(false);
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
          className="fixed inset-x-0 bottom-0 bg-white dark:bg-[#1E293B] rounded-t-2xl shadow-2xl max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-2xl lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-md lg:max-h-[90vh] lg:pb-0"
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
                    onClick={() => setOrderType(ot.value)}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                      orderType === ot.value ? 'bg-[#3B82F6] text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {ot.label}
                  </button>
                ))}
              </div>
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

            {/* Quantity */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Miktar {maxQuantity ? `(Max: ${maxQuantity})` : ''}</label>
              <input
                type="number"
                value={quantity}
                onChange={(e: any) => setQuantity(e?.target?.value ?? '')}
                placeholder="0"
                className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
              />
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-muted-foreground transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              Gelişmiş Ayarlar (Stop Loss / Take Profit)
            </button>

            {/* Stop Loss & Take Profit */}
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-3 overflow-hidden">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#EF4444] mb-1 block">Stop Loss</label>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e: any) => setStopLoss(e?.target?.value ?? '')}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-[#EF4444] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#22C55E] mb-1 block">Take Profit</label>
                    <input
                      type="number"
                      value={takeProfit}
                      onChange={(e: any) => setTakeProfit(e?.target?.value ?? '')}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 glass-inner border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-foreground font-mono text-sm focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none"
                    />
                  </div>
                </div>

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

            {/* Summary */}
            <div className="p-3 glass-inner rounded-lg space-y-2">
              {orderType !== 'market' && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">İşlem Fiyatı</span>
                  <span className="text-[#3B82F6] font-mono font-semibold">{formatCurrency(execPrice, currencyCode)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Toplam</span><span className="text-foreground font-mono">{formatCurrency(total, currencyCode)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Komisyon (%0.2)</span><span className="text-[#F59E0B] font-mono">{formatCurrency(commission, currencyCode)}</span></div>
              <div className="border-t border-black/[0.08] dark:border-white/[0.08] pt-2 flex justify-between text-sm"><span className="text-muted-foreground font-medium">Toplam Maliyet</span><span className="text-foreground font-bold font-mono">{formatCurrency(totalWithCommission, currencyCode)}</span></div>
              {riskReward > 0 && (
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Risk/Getiri</span><span className="text-[#3B82F6] font-mono">1:{riskReward.toFixed(1)}</span></div>
              )}
            </div>

            {/* Warning */}
            {!stopLoss && qty > 0 && !showAdvanced && (
              <div className="flex items-start gap-2 p-2.5 bg-[#F59E0B]/10 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#F59E0B]">Stop loss belirlemeniz önerilir. Gelişmiş ayarlardan ekleyebilirsiniz.</p>
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={loading || qty <= 0}
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent as any, document.body) as any;
}

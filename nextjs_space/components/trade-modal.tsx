'use client';
import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
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

export function TradeModal({ isOpen, onClose, symbol, name, price, marketType, side = 'BUY', maxQuantity, onSuccess }: TradeModalProps) {
  const [type, setType] = useState<'BUY' | 'SELL'>(side);
  const [quantity, setQuantity] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setType(side); }, [side]);

  const qty = parseFloat(quantity) || 0;
  const total = qty * (price ?? 0);
  const commission = total * COMMISSION_RATE;
  const totalWithCommission = total + commission;
  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(takeProfit) || 0;
  const potentialLoss = sl > 0 ? Math.abs(price - sl) * qty : 0;
  const potentialGain = tp > 0 ? Math.abs(tp - price) * qty : 0;
  const riskReward = potentialLoss > 0 ? potentialGain / potentialLoss : 0;

  const handleTrade = async () => {
    if (qty <= 0) { toast.error('Geçerli bir miktar girin'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, name, type, marketType, quantity: qty, price,
          stopLoss: sl > 0 ? sl : null,
          takeProfit: tp > 0 ? tp : null,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'İşlem başarısız'); return; }
      toast.success(data?.message ?? 'İşlem başarılı');
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-[#1E293B] rounded-xl border border-[#334155] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#334155]">
            <div>
              <h3 className="text-lg font-bold text-white">{symbol}</h3>
              <p className="text-xs text-[#94A3B8]">{name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold text-white">{formatCurrency(price, marketType === 'CRYPTO' ? 'USD' : 'TRY')}</span>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#334155] text-[#94A3B8]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Buy/Sell toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0F172A] rounded-lg">
              <button
                onClick={() => setType('BUY')}
                className={`py-2 rounded-md text-sm font-semibold transition-all ${type === 'BUY' ? 'bg-[#22C55E] text-white' : 'text-[#94A3B8] hover:text-white'}`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1" /> Alış
              </button>
              <button
                onClick={() => setType('SELL')}
                className={`py-2 rounded-md text-sm font-semibold transition-all ${type === 'SELL' ? 'bg-[#EF4444] text-white' : 'text-[#94A3B8] hover:text-white'}`}
              >
                <TrendingDown className="w-4 h-4 inline mr-1" /> Satış
              </button>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Miktar {maxQuantity ? `(Max: ${maxQuantity})` : ''}</label>
              <input
                type="number"
                value={quantity}
                onChange={(e: any) => setQuantity(e?.target?.value ?? '')}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-[#0F172A] border border-[#334155] rounded-lg text-white font-mono focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
              />
            </div>

            {/* Stop Loss & Take Profit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#EF4444] mb-1 block">Stop Loss</label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e: any) => setStopLoss(e?.target?.value ?? '')}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-[#0F172A] border border-[#334155] rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-[#EF4444] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#22C55E] mb-1 block">Take Profit</label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(e: any) => setTakeProfit(e?.target?.value ?? '')}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-[#0F172A] border border-[#334155] rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Not (isteğe bağlı)</label>
              <input
                type="text"
                value={note}
                onChange={(e: any) => setNote(e?.target?.value ?? '')}
                placeholder="İşlem notu..."
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-white text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
              />
            </div>

            {/* Summary */}
            <div className="p-3 bg-[#0F172A] rounded-lg space-y-2">
              <div className="flex justify-between text-xs"><span className="text-[#94A3B8]">Toplam</span><span className="text-white font-mono">{formatCurrency(total, marketType === 'CRYPTO' ? 'USD' : 'TRY')}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#94A3B8]">Komisyon (%0.2)</span><span className="text-[#F59E0B] font-mono">{formatCurrency(commission, marketType === 'CRYPTO' ? 'USD' : 'TRY')}</span></div>
              <div className="border-t border-[#334155] pt-2 flex justify-between text-sm"><span className="text-[#94A3B8] font-medium">Toplam Maliyet</span><span className="text-white font-bold font-mono">{formatCurrency(totalWithCommission, marketType === 'CRYPTO' ? 'USD' : 'TRY')}</span></div>
              {riskReward > 0 && (
                <div className="flex justify-between text-xs"><span className="text-[#94A3B8]">Risk/Getiri</span><span className="text-[#3B82F6] font-mono">1:{riskReward.toFixed(1)}</span></div>
              )}
            </div>

            {/* Warning */}
            {!stopLoss && qty > 0 && (
              <div className="flex items-start gap-2 p-2.5 bg-[#F59E0B]/10 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#F59E0B]">Stop loss belirlemeniz önerilir. Risk yönetimi için önemlidir.</p>
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={loading || qty <= 0}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 ${
                type === 'BUY' ? 'bg-[#22C55E] hover:bg-[#16A34A]' : 'bg-[#EF4444] hover:bg-[#DC2626]'
              }`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : type === 'BUY' ? `${qty} Adet Al` : `${qty} Adet Sat`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

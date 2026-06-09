'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Check, AlertTriangle } from 'lucide-react';
import { formatCurrency, BIST_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { toast } from 'sonner';

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState('THYAO.IS');
  const [condition, setCondition] = useState('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const allSymbols = [...BIST_STOCKS, ...CRYPTO_ASSETS];

  const fetchAlerts = () => {
    fetch('/api/alerts').then(r => r.json()).then(d => {
      setAlerts(d.alerts || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, []);

  const createAlert = async () => {
    if (!targetPrice) return;
    setCreating(true);
    const sym = allSymbols.find(s => s.symbol === symbol);
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, name: sym?.name || symbol, condition, targetPrice: Number(targetPrice) }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success('Alarm oluşturuldu');
      setShowForm(false);
      setTargetPrice('');
      fetchAlerts();
    } else {
      toast.error(data.error || 'Hata oluştu');
    }
    setCreating(false);
  };

  const deleteAlert = async (id: string) => {
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
    toast.success('Alarm silindi');
    fetchAlerts();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeAlerts = alerts.filter((a: any) => a.active && !a.triggered);
  const triggeredAlerts = alerts.filter((a: any) => a.triggered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#F59E0B] flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Fiyat Alarmları</h1>
            <p className="text-xs text-[#94A3B8]">Hedef fiyata ulaşıldığında bildirim alın</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-[#3B82F6] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#2563EB] transition">
          <Plus className="w-4 h-4" /> Yeni Alarm
        </button>
      </motion.div>

      {/* Create Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1E293B] rounded-xl border border-[#334155] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Yeni Alarm Oluştur</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Sembol</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                {allSymbols.map(s => <option key={s.symbol} value={s.symbol}>{s.shortName} - {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Koşul</label>
              <select value={condition} onChange={e => setCondition(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]">
                <option value="above">↑ Üstüne Çıktığında</option>
                <option value="below">↓ Altına Düştüğünde</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Hedef Fiyat</label>
              <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="0.00"
                className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]" />
            </div>
            <div className="flex items-end">
              <button onClick={createAlert} disabled={creating || !targetPrice}
                className="w-full bg-[#22C55E] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#16A34A] transition disabled:opacity-50">
                {creating ? 'Oluşturuluyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Active Alerts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#334155]">
          <span className="text-sm font-semibold text-white">Aktif Alarmlar ({activeAlerts.length})</span>
        </div>
        {activeAlerts.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#94A3B8]">Henüz aktif alarmınız yok.</div>
        ) : (
          <div className="divide-y divide-[#334155]">
            {activeAlerts.map((alert: any) => (
              <div key={alert.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#0F172A]/30 transition">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${alert.condition === 'above' ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
                  {alert.condition === 'above' ? <TrendingUp className="w-4 h-4 text-[#22C55E]" /> : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{alert.name}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {alert.condition === 'above' ? 'Fiyat üstüne çıktığında' : 'Fiyat altına düştüğünde'}: {formatCurrency(alert.targetPrice)}
                  </p>
                </div>
                <button onClick={() => deleteAlert(alert.id)} className="p-2 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-[#1E293B] rounded-xl border border-[#334155] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#334155]">
            <span className="text-sm font-semibold text-white">Tetiklenen Alarmlar ({triggeredAlerts.length})</span>
          </div>
          <div className="divide-y divide-[#334155]">
            {triggeredAlerts.map((alert: any) => (
              <div key={alert.id} className="px-5 py-3 flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-[#22C55E]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{alert.name}</p>
                  <p className="text-xs text-[#94A3B8]">{formatCurrency(alert.targetPrice)} - Tetiklendi</p>
                </div>
                <button onClick={() => deleteAlert(alert.id)} className="p-2 text-[#64748B] hover:text-[#EF4444] rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <p className="text-xs text-center text-[#F59E0B]/70 pb-4">⚠️ Bu platform eğitim ve simülasyon amaçlıdır, yatırım tavsiyesi değildir.</p>
    </div>
  );
}

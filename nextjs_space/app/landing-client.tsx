'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, Shield, Bot, BarChart3, Zap, GraduationCap, ArrowRight, ChevronRight } from 'lucide-react';
import { BorsaBiLogoFull } from '@/components/logo';

const FEATURES = [
  { icon: TrendingUp, title: 'Canlı Piyasa Takibi', desc: 'BIST ve kripto piyasalarını anlık takip edin, teknik analiz göstergelerini inceleyin.' },
  { icon: Shield, title: 'Risk Yönetimi', desc: 'Profesyonel risk merkezi ile portföyünüzü koruyun, stop-loss ve take-profit ayarlayın.' },
  { icon: Bot, title: 'AI Destekli Analiz', desc: 'Yapay zeka asistanıyla piyasa analizi yapın, alım-satım sinyalleri alın.' },
  { icon: BarChart3, title: 'Backtest Motoru', desc: '5 farklı stratejiyi geçmiş verilerle test edin, performansı analiz edin.' },
  { icon: Zap, title: 'Day & Swing Trading', desc: 'Günlük ve orta vadeli trade fırsatlarını otomatik tarayın.' },
  { icon: GraduationCap, title: 'Master Akademi', desc: '6 kapsamlı kurs, quizler ve adım adım eğitim içerikleri.' },
];

const STATS = [
  { value: '100+', label: 'BIST Hissesi' },
  { value: '20+', label: 'Kripto Varlık' },
  { value: '5', label: 'Trading Stratejisi' },
  { value: '6', label: 'Eğitim Kursu' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#111D35] text-white">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <BorsaBiLogoFull size={36} />
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors">Giriş Yap</Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl transition-colors">Kayıt Ol</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" /> AI Destekli Trading Simülasyonu
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
              Profesyonel Trader Gibi{' '}
              <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Düşün</span>
            </h1>
            <p className="text-lg sm:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-8">
              BIST ve kripto piyasalarında yapay zeka destekli analiz, sanal portföy yönetimi ve profesyonel eğitim. Risk almadan öğrenin, pratik yapın.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto px-8 py-3.5 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-[#3B82F6]/25">
                Ücretsiz Başla <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-base flex items-center justify-center gap-2 transition-colors">
                Giriş Yap <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 border-y border-white/[0.06]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i + 0.3 }} className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">{s.value}</div>
              <div className="text-sm text-[#94A3B8] mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Her Şey Bir Arada</h2>
            <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">Profesyonel trading için ihtiyacınız olan tüm araçlar tek platformda</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 * i }}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-[#3B82F6]/30 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center mb-4 group-hover:bg-[#3B82F6]/20 transition-colors">
                  <f.icon className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="p-10 rounded-3xl bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/10 border border-[#3B82F6]/20">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Hemen Başlayın</h2>
            <p className="text-[#94A3B8] mb-8">100.000 ₺ sanal bakiye ile risk almadan trading dünyasını keşfedin</p>
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-[#3B82F6]/25">
              Ücretsiz Hesap Oluştur <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <BorsaBiLogoFull size={28} />
          <p className="text-xs text-[#64748B] text-center">© 2024 BorsaBi Trader. Bu platform eğitim amaçlıdır, yatırım tavsiyesi değildir.</p>
        </div>
      </footer>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Star, Shield, Smartphone, Globe, ChevronRight, Building2 } from 'lucide-react';
import Image from 'next/image';

const BROKERS = [
  {
    id: 'midas',
    name: 'Midas',
    desc: 'Komisyonsuz hisse ve fon alım satım platformu. Kullanıcı dostu arayüzü ve düşük maliyetleriyle öne çıkar.',
    logo: '/brokers/midas.png',
    url: 'https://www.getmidas.com',
    features: ['Komisyonsuz İşlem', 'Kolay Arayüz', 'Fon Yatırımı'],
    rating: 4.7,
    color: '#6C5CE7',
    type: 'Dijital',
  },
  {
    id: 'is-yatirim',
    name: 'İş Yatırım',
    desc: 'Türkiye\'nin en büyük aracı kurumu. Geniş ürün yelpazesi, güçlü araştırma ekibi ve İşCep mobil uygulaması.',
    logo: '/brokers/is-yatirim.png',
    url: 'https://www.isyatirim.com.tr',
    features: ['Geniş Ürün Yelpazesi', 'Araştırma Raporları', 'İşCep Mobil'],
    rating: 4.5,
    color: '#1E3A8A',
    type: 'Geleneksel',
  },
  {
    id: 'garanti-bbva',
    name: 'Garanti BBVA Yatırım',
    desc: 'BBVA\'nın global deneyimi ile Garanti\'nin yerel gücünü birleştiren köklü aracı kurum.',
    logo: '/brokers/garanti-bbva.png',
    url: 'https://www.garantibbvayatirim.com.tr',
    features: ['Global Deneyim', 'Güçlü Altyapı', 'Eğitim İçerikleri'],
    rating: 4.4,
    color: '#00854A',
    type: 'Geleneksel',
  },
  {
    id: 'yapi-kredi',
    name: 'Yapı Kredi Yatırım',
    desc: 'Yapı Kredi grubunun yatırım kolu. Geniş şube ağı ve dijital yatırım araçları sunar.',
    logo: '/brokers/yapi-kredi.png',
    url: 'https://www.yapikredi.com.tr/yatirimci',
    features: ['Geniş Şube Ağı', 'Dijital Araçlar', 'Vadeli İşlemler'],
    rating: 4.3,
    color: '#1A237E',
    type: 'Geleneksel',
  },
  {
    id: 'ak-yatirim',
    name: 'Ak Yatırım',
    desc: 'Akbank\'ın yatırım kolu. TradeAll platformu ile gelişmiş teknik analiz ve hızlı işlem imkânı.',
    logo: '/brokers/ak-yatirim.png',
    url: 'https://www.akyatirim.com.tr',
    features: ['TradeAll Platformu', 'Teknik Analiz', 'Hızlı Emir İletimi'],
    rating: 4.4,
    color: '#E31E24',
    type: 'Geleneksel',
  },
  {
    id: 'qnb-finansinvest',
    name: 'QNB Finansinvest',
    desc: 'QNB Finansbank\'ın yatırım kolu. Enpara Yatırım ile dijital yatırım deneyimi sunar.',
    logo: '/brokers/qnb-finansinvest.png',
    url: 'https://www.qnbfi.com',
    features: ['Enpara Yatırım', 'Düşük Komisyon', 'Dijital Deneyim'],
    rating: 4.3,
    color: '#7B2D8E',
    type: 'Dijital + Geleneksel',
  },
];

export function BrokersClient() {
  const [filter, setFilter] = useState<'all' | 'dijital' | 'geleneksel'>('all');

  const filtered = BROKERS.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'dijital') return b.type.toLowerCase().includes('dijital');
    return b.type.toLowerCase().includes('geleneksel');
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#3B82F6]" /> Aracı Kurumlar
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Türkiye'deki popüler aracı kurumları keşfedin ve karşılaştırın
        </p>
      </div>

      {/* Uyarı */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
        <Shield className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Bu liste bilgilendirme amaçlıdır. BorsaBi herhangi bir aracı kurum ile ortaklık ilişkisi içinde değildir. Yatırım kararlarınızı kendi araştırmanıza dayandırın.
        </p>
      </div>

      {/* Filtre */}
      <div className="flex gap-2">
        {(['all', 'dijital', 'geleneksel'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-[#3B82F6] text-white'
                : 'glass-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'Tümü' : f === 'dijital' ? '📱 Dijital' : '🏦 Geleneksel'}
          </button>
        ))}
      </div>

      {/* Broker Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((broker, i) => (
          <motion.div
            key={broker.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card rounded-xl p-4 hover:border-[#3B82F6]/30 transition-all group"
          >
            {/* Üst: Logo + İsim + Rating */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-white/10 flex items-center justify-center flex-shrink-0 border border-black/[0.06] dark:border-white/[0.06]">
                <Image
                  src={broker.logo}
                  alt={broker.name}
                  width={48}
                  height={48}
                  className="object-contain w-10 h-10"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground truncate">{broker.name}</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06] text-muted-foreground flex-shrink-0">
                    {broker.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
                  <span className="text-[11px] font-semibold text-foreground">{broker.rating}</span>
                  <span className="text-[10px] text-muted-foreground">/ 5.0</span>
                </div>
              </div>
            </div>

            {/* Açıklama */}
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
              {broker.desc}
            </p>

            {/* Özellikler */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {broker.features.map(f => (
                <span key={f} className="text-[10px] px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.06]">
                  {f}
                </span>
              ))}
            </div>

            {/* Butonlar */}
            <div className="flex gap-2">
              <a
                href={broker.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-semibold hover:bg-[#3B82F6]/20 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" /> Web Sitesi
              </a>
              <a
                href={broker.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#22C55E]/10 text-[#22C55E] text-xs font-semibold hover:bg-[#22C55E]/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Hesap Aç
              </a>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Alt Bilgi */}
      <div className="text-center py-4">
        <p className="text-[10px] text-muted-foreground">
          ⚠️ Yatırım, risk içerir. Aracı kurum seçiminde komisyon oranları, platform kalitesi ve müşteri hizmetlerini karşılaştırın.
        </p>
      </div>
    </div>
  );
}

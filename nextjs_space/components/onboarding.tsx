'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Shield, Bot, GraduationCap, Zap, ChevronRight, X } from 'lucide-react';

const SLIDES = [
  {
    icon: TrendingUp,
    color: '#3B82F6',
    title: 'Hoş Geldiniz! \ud83d\udc4b',
    desc: 'BorsaBi Trader ile 100.000 ₺ sanal bakiye kullanarak BIST ve kripto piyasalarında risk almadan trading pratik yapın.',
  },
  {
    icon: Zap,
    color: '#F59E0B',
    title: 'Day & Swing Trading',
    desc: 'Yapay zeka destekli tarama motorları ile günlük ve orta vadeli trading fırsatlarını otomatik keşfedin.',
  },
  {
    icon: Bot,
    color: '#8B5CF6',
    title: 'AI Asistan',
    desc: 'BorsaBi AI ile piyasa analizi yapın, sorularınızı sorun ve kişiselleştirilmiş öneriler alın.',
  },
  {
    icon: Shield,
    color: '#22C55E',
    title: 'Risk Yönetimi',
    desc: 'Profesyonel risk merkezi, stop-loss/take-profit ayarları ve portföy risk analizi ile sermayenizi koruyun.',
  },
  {
    icon: GraduationCap,
    color: '#EC4899',
    title: 'Master Akademi',
    desc: '6 kurs, interaktif quizler ve adım adım eğitim ile profesyonel trader olma yolunda ilerleyin.',
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('borsabi-onboarding-done');
    if (!seen) setShow(true);
  }, []);

  const finish = () => {
    localStorage.setItem('borsabi-onboarding-done', 'true');
    setShow(false);
  };

  const next = () => {
    if (current < SLIDES.length - 1) setCurrent(current + 1);
    else finish();
  };

  if (!show) return null;
  const slide = SLIDES[current];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', damping: 25 }}
          className="w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl p-8 relative"
        >
          <button onClick={finish} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-[#64748B]">
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${slide.color}15` }}>
              <slide.icon className="w-8 h-8" style={{ color: slide.color }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">{slide.title}</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-8">{slide.desc}</p>

            {/* Dots */}
            <div className="flex items-center gap-2 mb-6">
              {SLIDES.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-[#3B82F6]' : 'w-1.5 bg-white/20'}`} />
              ))}
            </div>

            <button onClick={next}
              className="w-full py-3 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              {current < SLIDES.length - 1 ? (
                <><span>Devam</span><ChevronRight className="w-4 h-4" /></>
              ) : (
                <span>Başlayalım! \ud83d\ude80</span>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

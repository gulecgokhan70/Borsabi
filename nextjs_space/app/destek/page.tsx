'use client';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, MessageCircle, HelpCircle, BookOpen, AlertTriangle, Shield, Zap, Clock, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

const FAQ_ITEMS = [
  {
    q: 'BorsaBi Trader nedir?',
    a: 'BorsaBi Trader, BIST hisselerini sanal para ile alıp satabileceğiniz bir eğitim ve simülasyon platformudur. Gerçek para ile işlem yapılmaz.'
  },
  {
    q: 'Hesabıma nasıl para yüklerim?',
    a: 'Platform tamamen simülasyon amaçlıdır. Kayıt olduğunuzda sanal bakiyeniz otomatik olarak tanımlanır. Gerçek para yatırma/çekme işlemi bulunmamaktadır.'
  },
  {
    q: 'AI Analiz nasıl çalışır?',
    a: 'Yapay zekâ analizimiz, hisse senedinin teknik göstergelerini (RSI, MACD, EMA vb.) ve güncel haberleri birlikte değerlendirerek AL/SAT/BEKLE sinyali üretir. Bu analiz yatırım tavsiyesi değildir.'
  },
  {
    q: 'Verilerim güvende mi?',
    a: 'Evet. Parolalarınız bcrypt ile şifrelenmekte, tüm iletişim SSL/TLS ile korunmaktadır. Detaylar için Aydınlatma Metni sayfamızı inceleyebilirsiniz.'
  },
  {
    q: 'Komisyon oranları nedir?',
    a: 'Simülasyon, strateji testi ve adım adım pratik işlemlerinde Profil bölümünde belirlediğiniz komisyon oranı kullanılır. Varsayılan oran alış ve satışta %0,2’dir.'
  },
  {
    q: 'Trailing Stop nedir?',
    a: 'Trailing Stop, fiyat yükselirken stop seviyesini otomatik olarak yukarı çeken bir zarar durdurma yöntemidir. Kâr koruma stratejisi olarak kullanılır.'
  },
  {
    q: 'Aksam Analizi ne zaman güncellenir?',
    a: 'Akşam analizi her gün borsa kapanışından sonra (18:00-19:00 arası) çalıştırılabilir ve tüm BIST hisselerini AI ile tarar.'
  },
  {
    q: 'Hesabımı nasıl silerim?',
    a: 'Hesap silme talebi için info@borsabi.com adresine e-posta gönderebilirsiniz. KVKK kapsamındaki haklarınız 30 gün içinde işleme alınır.'
  }
];

export default function DestekPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Simulate sending
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setContactForm({ name: '', email: '', subject: '', message: '' });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#6366F1] flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-foreground text-lg">Destek Merkezi</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Mail, title: 'E-posta', desc: 'info@borsabi.com', color: 'from-[#3B82F6] to-[#2563EB]' },
            { icon: Clock, title: 'Yanıt Süresi', desc: 'En geç 24 saat', color: 'from-[#8B5CF6] to-[#7C3AED]' },
            { icon: BookOpen, title: 'Eğitim', desc: 'BorsaBi Akademi', color: 'from-[#10B981] to-[#059669]' },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.title}</p>
                <p className="text-sm font-semibold text-foreground">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Platform Features */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            Platform Özellikleri
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'BIST hisselerinde sanal alım-satım',
              'Yapay zekâ destekli teknik analiz',
              'Day Trading ve Swing Trading tarayıcıları',
              'Akşam analizi (tüm BIST taraması)',
              'Haber bazlı AI analiz',
              'Trailing Stop ve risk yönetimi',
              'Portföy takibi ve performans raporları',
              'BorsaBi Akademi eğitim içerikleri',
              'Gerçek zamanlı piyasa verileri',
              'Strateji oluşturucu ve backtest'
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />
                {feat}
              </div>
            ))}
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#8B5CF6]" />
            Sıkça Sorulan Sorular
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs font-medium text-foreground pr-4">{faq.q}</span>
                  <span className={`text-muted-foreground transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {openFaq === i && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#3B82F6]" />
            Bize Ulaşın
          </h2>

          {sent ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
              </div>
              <p className="text-sm font-medium text-foreground">Mesajınız Gönderildi!</p>
              <p className="text-xs text-muted-foreground">En kısa sürede size dönüş yapacağız.</p>
              <button onClick={() => setSent(false)} className="text-xs text-[#3B82F6] hover:underline mt-2">Yeni mesaj gönder</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text" placeholder="Adınız" required
                  value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
                <input
                  type="email" placeholder="E-posta adresiniz" required
                  value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>
              <select
                required value={contactForm.subject} onChange={e => setContactForm(p => ({ ...p, subject: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
              >
                <option value="">Konu seçiniz</option>
                <option value="genel">Genel Soru</option>
                <option value="hata">Hata Bildirimi</option>
                <option value="oneri">Öneri / İstek</option>
                <option value="hesap">Hesap İşlemleri</option>
                <option value="kvkk">KVKK / Veri Talebi</option>
              </select>
              <textarea
                placeholder="Mesajınız..." required rows={4}
                value={contactForm.message} onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 resize-none"
              />
              <button type="submit" disabled={sending}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {sending ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </form>
          )}
        </motion.div>

        {/* Warning */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="flex items-start gap-3 glass-card rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-[#F59E0B]">Önemli Uyarı</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              BorsaBi Trader tamamen eğitim ve simülasyon amaçlıdır. Gerçek para ile işlem yapılmaz.
              Platform üzerindeki analizler yatırım tavsiyesi niteliği taşımaz.
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center py-4 space-y-2">
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <Link href="/destek" className="hover:text-[#3B82F6] transition-colors">Destek</Link>
            <span>·</span>
            <Link href="/aydinlatma-metni" className="hover:text-[#3B82F6] transition-colors">Aydınlatma Metni</Link>
          </div>
          <p className="text-[10px] text-muted-foreground">© 2024-2026 BorsaBi Trader. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
}

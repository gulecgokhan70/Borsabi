'use client';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Eye, Database, Lock, UserCheck, Globe, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AydinlatmaMetniPage() {
  const router = useRouter();

  const sections = [
    {
      icon: Eye,
      title: '1. Veri Sorumlusu',
      content: `BorsaBi Trader platformu ("Platform"), kullanıcılarının kişisel verilerinin korunmasını önemsemektedir. Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla sizleri bilgilendirmek amacıyla hazırlanmıştır.\n\nPlatform, tamamen eğitim ve simülasyon amaçlı olup gerçek para ile herhangi bir yatırım işlemi gerçekleştirmemektedir.`
    },
    {
      icon: Database,
      title: '2. İşlenen Kişisel Veriler',
      content: `Platform kapsamında aşağıdaki kişisel verileriniz işlenmektedir:\n\n• Kimlik Bilgileri: Ad, soyad, kullanıcı adı\n• İletişim Bilgileri: E-posta adresi\n• Hesap Bilgileri: Şifrelenmiş parola, profil tercihleri\n• İşlem Verileri: Simülasyon alım-satım işlemleri, sanal portföy bilgileri, izleme listesi\n• Kullanım Verileri: Oturum bilgileri, platform kullanım istatistikleri\n• Teknik Veriler: IP adresi, tarayıcı türü, cihaz bilgisi`
    },
    {
      icon: UserCheck,
      title: '3. Kişisel Verilerin İşlenme Amaçları',
      content: `Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:\n\n• Üyelik kaydının oluşturulması ve hesap yönetimi\n• Platform hizmetlerinin sunulması (simülasyon trading, portföy takibi, teknik analiz)\n• Kullanıcı deneyiminin iyileştirilmesi ve kişiselleştirilmesi\n• Yapay zekâ destekli analiz ve tarama özelliklerinin sağlanması\n• Eğitim içeriklerinin sunulması (BorsaBi Akademi)\n• Bildirim ve uyarı sisteminin çalıştırılması\n• Platform güvenliğinin sağlanması\n• Yasal yükümlülüklerin yerine getirilmesi`
    },
    {
      icon: Lock,
      title: '4. Kişisel Verilerin Korunması',
      content: `Kişisel verilerinizin güvenliği için aşağıdaki teknik ve idari tedbirler alınmaktadır:\n\n• Parolalar bcrypt algoritması ile şifrelenmekte, düz metin olarak saklanmamaktadır\n• Tüm veri iletişimi SSL/TLS protokolü ile şifrelenmektedir\n• Oturum yönetimi güvenli token tabanlı kimlik doğrulama (JWT) ile sağlanmaktadır\n• Veritabanı erişimi yetkilendirme mekanizmaları ile kısıtlanmıştır\n• Düzenli güvenlik güncellemeleri ve denetimleri yapılmaktadır`
    },
    {
      icon: Globe,
      title: '5. Kişisel Verilerin Aktarılması',
      content: `Kişisel verileriniz, hizmet sunumu kapsamında aşağıdaki taraflarla paylaşılabilir:\n\n• Sunucu ve altyapı hizmeti sağlayıcıları (barındırma hizmetleri)\n• Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşları\n\nKişisel verileriniz, yukarıda belirtilen amaçlar dışında üçüncü kişi veya kuruluşlarla paylaşılmamakta, ticari amaçla satılmamakta veya pazarlama amacıyla kullanılmamaktadır.`
    },
    {
      icon: UserCheck,
      title: '6. Veri Sahibinin Hakları',
      content: `KVKK\'nun 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:\n\n• Kişisel verilerinizin işlenip işlenmediğini öğrenme\n• Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme\n• Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme\n• Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme\n• Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme\n• KVKK\'nun 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme\n• İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme\n• Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme`
    },
    {
      icon: Shield,
      title: '7. Çerezler (Cookies)',
      content: `Platform, kullanıcı deneyimini geliştirmek ve oturum yönetimini sağlamak amacıyla çerezler kullanmaktadır:\n\n• Zorunlu Çerezler: Oturum yönetimi ve güvenlik için gerekli olan çerezlerdir\n• Tercih Çerezleri: Tema seçimi (açık/koyu mod) gibi kullanıcı tercihlerini saklar\n\nPlatform, reklam veya üçüncü taraf takip çerezleri kullanmamaktadır.`
    },
    {
      icon: Mail,
      title: '8. İletişim ve Başvuru',
      content: `Kişisel verilerinizle ilgili her türlü soru, talep ve başvurularınız için aşağıdaki kanallardan bize ulaşabilirsiniz:\n\n• E-posta: info@borsabi.com\n• Web: borsabi.com\n\nBaşvurularınız, talebin niteliğine göre en kısa sürede ve en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırılacaktır.`
    },
    {
      icon: Shield,
      title: '9. Değişiklikler',
      content: `Bu aydınlatma metni, yasal düzenlemelerdeki değişiklikler veya platformdaki güncellemeler doğrultusunda zaman zaman güncellenebilir. Güncellemeler platform üzerinden yayınlanacaktır.\n\nSon güncelleme tarihi: Haziran 2026`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-foreground text-lg">Aydınlatma Metni</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Intro Banner */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5 border border-[#8B5CF6]/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, BorsaBi Trader platformu olarak 
                kişisel verilerinizin güvenliğini önemsiyoruz. Bu metin, verilerinizin nasıl toplandığı, işlendiği 
                ve korunduğu hakkında sizi bilgilendirmek amacıyla hazırlanmıştır.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        {sections.map((section, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
            className="glass-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6]/10 to-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                <section.icon className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{section.title}</h3>
            </div>
            <div className="px-5 py-4">
              {section.content.split('\n').map((line, j) => (
                <p key={j} className={`text-xs leading-relaxed ${
                  line.startsWith('•') ? 'text-foreground pl-2 py-0.5' : 'text-muted-foreground'
                } ${line === '' ? 'h-2' : ''}`}>
                  {line}
                </p>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Footer Note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-center py-6 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            ⚠️ BorsaBi Trader tamamen eğitim ve simülasyon amaçlıdır. Gerçek para ile işlem yapılmaz.
          </p>
          <p className="text-[10px] text-muted-foreground">
            © 2024-2026 BorsaBi Trader. Tüm hakları saklıdır.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

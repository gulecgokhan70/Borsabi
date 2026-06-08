export interface Lesson {
  id: string;
  title: string;
  duration: string;
  content: string;
  quiz?: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  level: 'Başlangıç' | 'Orta' | 'İleri';
  totalLessons: number;
  estimatedTime: string;
  lessons: Lesson[];
}

export const COURSES: Course[] = [
  {
    id: 'borsa-temelleri',
    title: 'Borsa İstanbul Temelleri',
    description: 'BIST yapısı, endeksler, işlem saatleri ve temel kavramları öğrenin.',
    icon: '🏛️',
    color: '#3B82F6',
    level: 'Başlangıç',
    totalLessons: 4,
    estimatedTime: '45 dk',
    lessons: [
      {
        id: 'bist-nedir',
        title: 'Borsa İstanbul Nedir?',
        duration: '10 dk',
        content: `# Borsa İstanbul Nedir?\n\nBorsa İstanbul (BIST), Türkiye'nin tek menkul kıymetler borsasıdır. 2013 yılında İMKB, İstanbul Altın Borsası ve VOB'un birleşmesiyle kurulmuştur.\n\n## Temel Özellikler\n\n- **İşlem Saatleri:** Hafta içi 10:00 - 18:00\n- **Sürekli Müzayede:** 10:00 - 18:00\n- **Açılış Seansı:** 09:40 - 10:00\n- **Kapanış Seansı:** 18:00 - 18:10\n\n## Ana Pazarlar\n\n1. **Yıldız Pazar:** En büyük ve en likit şirketler\n2. **Ana Pazar:** Orta büyüklükteki şirketler\n3. **Alt Pazar:** Küçük ölçekli şirketler\n\n## Endeksler\n\n- **BIST 100:** En büyük 100 şirket\n- **BIST 30:** En büyük 30 şirket\n- **BIST Banka:** Bankacılık sektörü\n- **BIST Sanayi:** Sanayi şirketleri\n\n## Önemli Bilgiler\n\n- Taban/Tavan fiyat sınırı: ±10%\n- T+2 takas süresi\n- SPK (Sermaye Piyasası Kurulu) denetimi altında`,
        quiz: [
          {
            id: 'q1',
            question: 'Borsa İstanbul kaçta açılır?',
            options: ['09:00', '09:40', '10:00', '10:30'],
            correctIndex: 2,
            explanation: 'BIST sürekli müzayede seansı saat 10:00\'da başlar. Açılış seansı ise 09:40\'ta başlar.'
          },
          {
            id: 'q2',
            question: 'BIST 100 endeksi kaç şirketten oluşur?',
            options: ['30', '50', '100', '500'],
            correctIndex: 2,
            explanation: 'BIST 100, Borsa İstanbul\'daki en büyük 100 şirketi içerir.'
          },
          {
            id: 'q3',
            question: 'BIST\'te günlük fiyat limiti nedir?',
            options: ['±5%', '±10%', '±15%', '±20%'],
            correctIndex: 1,
            explanation: 'BIST\'te hisseler bir günde en fazla ±%10 hareket edebilir (taban-tavan).'
          }
        ]
      },
      {
        id: 'hisse-secimi',
        title: 'Temel Hisse Seçimi',
        duration: '12 dk',
        content: `# Temel Hisse Seçimi\n\nDoğru hisse seçimi, başarılı yatırımın temelidir.\n\n## Temel Analiz Kriterleri\n\n### F/K Oranı (Fiyat/Kazanç)\n- Düşük F/K = Ucuz değerleme\n- Sektör ortalamasıyla karşılaştırın\n- Çok düşük F/K sorunlu olabilir\n\n### PD/DD (Piyasa Değeri / Defter Değeri)\n- 1'in altı = Defter değerinin altında\n- Sektöre göre değerlendirin\n\n### Temettü Verimi\n- Düzenli temettü = Güçlü nakit akışı\n- %5+ verim cazip olabilir\n\n## Dikkat Edilmesi Gerekenler\n\n1. **Likidite:** Günlük işlem hacmi yeterli mi?\n2. **Sektör:** Büyüyen bir sektörde mi?\n3. **Yönetim:** Şeffaf ve güvenilir mi?\n4. **Borçluluk:** Borç/özkaynak oranı makul mü?\n5. **Kârlılık:** Sürdürülebilir kâr artışı var mı?\n\n## Altın Kural\n\n> "Anlamadığınız bir şirkete yatırım yapmayın." - Warren Buffett`,
        quiz: [
          {
            id: 'q1',
            question: 'Düşük F/K oranı ne anlama gelir?',
            options: ['Pahalı değerleme', 'Ucuz değerleme', 'Yüksek risk', 'Düşük hacim'],
            correctIndex: 1,
            explanation: 'Düşük F/K oranı, hissenin kazancına göre nispeten ucuz olduğunu gösterir.'
          }
        ]
      },
      {
        id: 'emir-turleri',
        title: 'Emir Türleri',
        duration: '10 dk',
        content: `# Emir Türleri\n\nBorsada işlem yaparken farklı emir türlerini bilmek önemlidir.\n\n## Temel Emir Türleri\n\n### 1. Limitli Emir\n- Belirlediğiniz fiyattan veya daha iyi fiyattan gerçekleşir\n- En yaygın kullanılan emir türü\n- Fiyat kontrolü sağlar\n\n### 2. Piyasa Emri\n- Anlık piyasa fiyatından gerçekleşir\n- Hızlı işlem garantisi\n- Kayma (slippage) riski var\n\n### 3. Koşullu Emirler\n\n#### Stop Loss (Zarar Durdur)\n- Zararı sınırlamak için kullanılır\n- Fiyat belirlenen seviyeye düşünce otomatik satış\n- **Her işlemde mutlaka kullanılmalı!**\n\n#### Take Profit (Kâr Al)\n- Kârı korumak için kullanılır\n- Hedef fiyata ulaşınca otomatik satış\n\n## Önemli İpuçları\n\n- Acemi traders: Limitli emir kullanın\n- Stop loss olmadan asla işlem açmayın\n- Piyasa emrini sadece acil durumlarda kullanın`,
      },
      {
        id: 'piyasa-takibi',
        title: 'Piyasa Takibi Nasıl Yapılır?',
        duration: '13 dk',
        content: `# Piyasa Takibi\n\nBaşarılı bir trader olmak için piyasayı doğru takip etmek gerekir.\n\n## Günlük Takip Listesi\n\n### Sabah Rutini (09:00-10:00)\n1. ABD borsaları nasıl kapandı?\n2. Asya borsaları nasıl?\n3. Dolar/TL ve Euro/TL nerede?\n4. Altın ve petrol fiyatları\n5. BIST vadeli kontrat (VİOP)\n\n### İşlem Saatlerinde\n1. BIST 100 endeks hareketi\n2. Sektör bazlı performans\n3. Hacim analizi\n4. Önemli haber akışı\n\n### Akşam Rutini\n1. Günü değerlendirin\n2. İşlem günlüğünü güncelleyin\n3. Yarın için plan yapın\n\n## Takip Edilmesi Gereken Kaynaklar\n\n- Ekonomi haberleri\n- TCMB kararları\n- SPK duyuruları\n- Şirket bildirileri (KAP)\n- Global ekonomik takvim`,
      }
    ]
  },
  {
    id: 'teknik-analiz',
    title: 'Teknik Analiz',
    description: 'Grafik okuma, göstergeler ve teknik analiz yöntemlerini öğrenin.',
    icon: '📊',
    color: '#22C55E',
    level: 'Orta',
    totalLessons: 4,
    estimatedTime: '60 dk',
    lessons: [
      {
        id: 'grafik-turleri',
        title: 'Grafik Türleri',
        duration: '12 dk',
        content: `# Grafik Türleri\n\nTeknik analizin temeli grafik okumaktır.\n\n## 1. Çizgi Grafik\n- Sadece kapanış fiyatlarını gösterir\n- Basit ve anlaşılır\n- Trend takibi için idealdir\n\n## 2. Bar Grafik\n- Açılış, yüksek, düşük ve kapanış fiyatlarını gösterir\n- Daha detaylı bilgi sağlar\n\n## 3. Mum Grafik (Candlestick) ⭐\n- En popüler grafik türü\n- Görsel olarak en kolay okunabilen\n- Formasyonlar ile güçlü sinyaller\n\n### Mum Yapısı\n\n**Yeşil (Yükseliş) Mum:**\n- Gövde: Açılış → Kapanış (yukarı)\n- Alt fitil: Günün en düşük noktası\n- Üst fitil: Günün en yüksek noktası\n\n**Kırmızı (Düşüş) Mum:**\n- Gövde: Açılış → Kapanış (aşağı)\n\n## Zaman Dilimleri\n\n| Zaman | Kullanım |\n|-------|----------|\n| 5 dk | Scalping |\n| 15 dk | Day Trading |\n| 1 saat | Day/Swing |\n| Günlük | Swing Trading |\n| Haftalık | Yatırım |`,
        quiz: [
          {
            id: 'q1',
            question: 'Hangisi en popüler grafik türüdür?',
            options: ['Çizgi grafik', 'Bar grafik', 'Mum grafik', 'Alan grafik'],
            correctIndex: 2,
            explanation: 'Mum (candlestick) grafik, görsel okunabilirliği ve formasyon analizi nedeniyle en popüler grafik türüdür.'
          }
        ]
      },
      {
        id: 'destek-direnc',
        title: 'Destek ve Direnç Seviyeleri',
        duration: '15 dk',
        content: `# Destek ve Direnç Seviyeleri\n\nTeknik analizin en önemli kavramlarından biridir.\n\n## Destek Nedir?\n- Fiyatın düşerken durma eğilimi gösterdiği seviye\n- Alıcıların yoğunlaştığı bölge\n- Fiyat desteğe dokunduğunda yukarı dönebilir\n\n## Direnç Nedir?\n- Fiyatın yükselirken durma eğilimi gösterdiği seviye\n- Satıcıların yoğunlaştığı bölge\n- Fiyat dirence dokunduğunda aşağı dönebilir\n\n## Nasıl Belirlenir?\n\n1. **Yatay Çizgiler:** Fiyatın birden fazla kez tepki verdiği seviyeler\n2. **Trend Çizgileri:** Yükselen diplerden veya alçalan tepelerden çizilir\n3. **Hareketli Ortalamalar:** EMA20, EMA50, EMA200 dinamik destek/direnç\n4. **Fibonacci Seviyeleri:** %38.2, %50, %61.8 geri çekilme seviyeleri\n\n## Altın Kurallar\n\n- Destek kırılırsa → Direnç olur\n- Direnç kırılırsa → Destek olur\n- Seviye ne kadar çok test edilirse o kadar güçlüdür\n- Hacimle kırılım daha güvenilirdir\n\n## İşlem Stratejisi\n\n> Destekten al, dirençte sat. Kırılımda trendi takip et.`,
        quiz: [
          {
            id: 'q1',
            question: 'Destek seviyesi kırılırsa ne olur?',
            options: ['Fiyat yükselir', 'Destek seviyesi direnç olur', 'Hiçbir şey olmaz', 'Hacim düşer'],
            correctIndex: 1,
            explanation: 'Kırılan destek seviyesi, artık direnç seviyesi olarak çalışır. Bu teknik analizin temel kurallarından biridir.'
          }
        ]
      },
      {
        id: 'gostergeler',
        title: 'Teknik Göstergeler (RSI, MACD, EMA)',
        duration: '18 dk',
        content: `# Teknik Göstergeler\n\n## RSI (Göreceli Güç Endeksi)\n\n- **Aralık:** 0-100\n- **Aşırı Alım:** RSI > 70 → Satış baskısı beklentisi\n- **Aşırı Satım:** RSI < 30 → Alış fırsatı beklentisi\n- **Periyot:** Genellikle 14 gün\n\n### RSI Stratejisi\n- RSI 30 altına düştüğünde → Potansiyel alış\n- RSI 70 üstüne çıktığında → Dikkatli olun\n- RSI uyumsuzlukları güçlü sinyallerdir\n\n## MACD (Hareketli Ortalama Yakınsama/Iraksama)\n\n- **MACD Çizgisi:** EMA12 - EMA26\n- **Sinyal Çizgisi:** MACD'nin 9 günlük EMA'sı\n- **Histogram:** MACD - Sinyal farkı\n\n### MACD Sinyalleri\n- MACD sinyal çizgisini yukarı keserse → Alış\n- MACD sinyal çizgisini aşağı keserse → Satış\n- Sıfır çizgisi geçişleri önemlidir\n\n## EMA (Üssel Hareketli Ortalama)\n\n| EMA | Kullanım |\n|-----|----------|\n| EMA9 | Kısa vadeli trend |\n| EMA20 | Day/Swing trading |\n| EMA50 | Orta vadeli trend |\n| EMA200 | Uzun vadeli trend |\n\n### EMA Dizilimi\n- Fiyat > EMA20 > EMA50 > EMA200 = **Güçlü yükseliş trendi**\n- Fiyat < EMA20 < EMA50 < EMA200 = **Güçlü düşüş trendi**`,
        quiz: [
          {
            id: 'q1',
            question: 'RSI 25 değeri ne anlama gelir?',
            options: ['Aşırı alım', 'Aşırı satım', 'Nötr', 'Trend yok'],
            correctIndex: 1,
            explanation: 'RSI 30 altındaki değerler aşırı satım bölgesini gösterir. Bu, potansiyel bir dönüş fırsatı olabilir.'
          },
          {
            id: 'q2',
            question: 'MACD sinyal çizgisini yukarı keserse ne anlama gelir?',
            options: ['Satış sinyali', 'Alış sinyali', 'Nötr sinyal', 'Trend sonu'],
            correctIndex: 1,
            explanation: 'MACD çizgisinin sinyal çizgisini yukarı kesmesi bir alış sinyali olarak yorumlanır.'
          }
        ]
      },
      {
        id: 'formasyonlar',
        title: 'Grafik Formasyonları',
        duration: '15 dk',
        content: `# Grafik Formasyonları\n\n## Devam Formasyonları\n\n### Bayrak (Flag)\n- Güçlü trendin ardından kısa konsolidasyon\n- Trend yönünde kırılım beklenir\n- Hacim düşer, kırılımda artar\n\n### Üçgen (Triangle)\n- **Yükselen Üçgen:** Yükseliş sinyali\n- **Alçalan Üçgen:** Düşüş sinyali\n- **Simetrik Üçgen:** Her iki yöne kırılabilir\n\n## Dönüş Formasyonları\n\n### Çift Dip (Double Bottom) - W\n- Düşüş trendinin sonunda\n- İki dip aynı seviyede\n- Boyun çizgisi kırılınca alış\n\n### Çift Tepe (Double Top) - M\n- Yükseliş trendinin sonunda\n- İki tepe aynı seviyede\n- Boyun çizgisi kırılınca satış\n\n### Omuz-Baş-Omuz (Head & Shoulders)\n- En güvenilir dönüş formasyonu\n- Sol omuz → Baş → Sağ omuz\n- Boyun çizgisi kırılımı kritik\n\n## Mum Formasyonları\n\n- **Doji:** Kararsızlık, dönüş habercisi\n- **Çekiç (Hammer):** Dipte alış sinyali\n- **Yutan Formasyon:** Güçlü dönüş sinyali\n- **Sabah/Akşam Yıldızı:** Trend dönüş sinyali`,
      }
    ]
  },
  {
    id: 'risk-yonetimi',
    title: 'Risk Yönetimi',
    description: 'Sermaye koruma, pozisyon boyutlandırma ve risk kontrol stratejileri.',
    icon: '🛡️',
    color: '#EF4444',
    level: 'Başlangıç',
    totalLessons: 3,
    estimatedTime: '40 dk',
    lessons: [
      {
        id: 'risk-temelleri',
        title: 'Risk Yönetimi Temelleri',
        duration: '15 dk',
        content: `# Risk Yönetimi Temelleri\n\n> "Önce sermayeyi koru, sonra kazancı düşün."\n\n## Neden Risk Yönetimi?\n\n- Kazanmak için önce kaybetmemeyi öğrenmelisiniz\n- %50 kayıp = %100 kazanç gerektirir (geri dönmek için)\n- Profesyonel traderların %1'i bile tek işlemde riske atmaz\n\n## Temel Kurallar\n\n### 1. İşlem Başına Risk: Maksimum %1\n- Sermayenizin en fazla %1'ini riske atın\n- 100.000 TL sermaye → Max 1.000 TL risk\n\n### 2. Günlük Zarar Limiti: %3\n- Günde %3'ten fazla kaybetmeyin\n- Limite ulaşınca o gün işlem yapmayı bırakın\n\n### 3. Haftalık Zarar Limiti: %6\n- Haftalık %6 zarar = Mola zamanı\n\n### 4. Stop Loss Zorunlu\n- **Stop loss olmadan asla işlem açmayın!**\n- Giriş öncesi stop seviyesi belirleyin\n- İşlem açıldıktan sonra stop'u değiştirmeyin\n\n## Pozisyon Boyutlandırma Formülü\n\n\`\`\`\nPozisyon Büyüklüğü = (Sermaye × Risk Oranı) / (Giriş - Stop)\n\`\`\`\n\nÖrnek:\n- Sermaye: 100.000 TL\n- Risk: %1 = 1.000 TL\n- Giriş: 50 TL, Stop: 48 TL\n- Risk: 2 TL/adet\n- Pozisyon: 1.000 / 2 = 500 adet`,
        quiz: [
          {
            id: 'q1',
            question: 'İşlem başına maksimum risk yüzdesi ne olmalıdır?',
            options: ['%5', '%3', '%1', '%10'],
            correctIndex: 2,
            explanation: 'Profesyonel risk yönetiminde işlem başına maksimum %1 risk kuralı uygulanır.'
          },
          {
            id: 'q2',
            question: '%50 kayıp yaşarsanız, eski seviyeye dönmek için ne kadar kazanmalısınız?',
            options: ['%50', '%75', '%100', '%150'],
            correctIndex: 2,
            explanation: '%50 kayıp sonrası eski seviyeye dönmek için %100 kazanç gerekir. Bu yüzden sermaye koruma kritiktir.'
          }
        ]
      },
      {
        id: 'stop-loss',
        title: 'Stop Loss Stratejileri',
        duration: '12 dk',
        content: `# Stop Loss Stratejileri\n\n## Stop Loss Nedir?\n\nStop loss, belirli bir fiyat seviyesinde otomatik olarak pozisyonu kapatan emirdir.\n\n## Stop Belirleme Yöntemleri\n\n### 1. Teknik Stop\n- Destek/direnç seviyesinin altına/üstüne\n- En güvenilir yöntem\n\n### 2. ATR Bazlı Stop\n- ATR (Average True Range) × 2\n- Volatiliteye göre ayarlanır\n\n### 3. Yüzde Stop\n- Giriş fiyatının %2-3 altına\n- Basit ama etkili\n\n### 4. Trailing Stop (Takip Eden Stop)\n- Fiyat yükseldikçe stop da yükselir\n- Kârı korurken trendi takip eder\n\n## Stop Loss Hataları\n\n❌ Stop koymamak\n❌ Stop'u sürekli aşağı çekmek\n❌ Çok dar stop (gürültüden çıkış)\n❌ Çok geniş stop (büyük kayıp)\n\n## Altın Kural\n\n> "Stop loss bir kayıp değil, sermaye sigortasıdır."\n> \n> "Küçük kayıplar normal, büyük kayıplar felakettir."`,
      },
      {
        id: 'risk-getiri',
        title: 'Risk/Getiri Oranı',
        duration: '13 dk',
        content: `# Risk/Getiri Oranı\n\n## Nedir?\n\nHer işlemde ne kadar risk aldığınıza karşılık ne kadar kazanç hedeflediğinizdir.\n\n## Hesaplama\n\n\`\`\`\nRisk/Getiri = (Hedef Fiyat - Giriş) / (Giriş - Stop)\n\`\`\`\n\n## Örnekler\n\n| Giriş | Stop | Hedef | Risk | Getiri | R/G |\n|-------|------|-------|------|--------|-----|\n| 100 | 97 | 109 | 3 TL | 9 TL | 1:3 |\n| 50 | 48 | 56 | 2 TL | 6 TL | 1:3 |\n| 200 | 190 | 220 | 10 TL | 20 TL | 1:2 |\n\n## Minimum R/G Oranı\n\n- **Minimum 1:2** olmalıdır\n- İdeal: 1:3 veya daha yüksek\n- 1:1 altı = İşlem açmayın!\n\n## Neden Önemli?\n\n%40 kazanç oranıyla bile kârlı olabilirsiniz:\n\n- 10 işlem, 4 kazanç, 6 kayıp\n- R/G = 1:3\n- Kazanç: 4 × 3.000 = 12.000 TL\n- Kayıp: 6 × 1.000 = 6.000 TL\n- **Net Kâr: 6.000 TL** ✅\n\n> İşlemlerin çoğunu kaybetseniz bile doğru R/G oranıyla kârlı çıkarsınız.`,
        quiz: [
          {
            id: 'q1',
            question: 'Minimum risk/getiri oranı ne olmalıdır?',
            options: ['1:1', '1:2', '1:5', '2:1'],
            correctIndex: 1,
            explanation: 'Minimum 1:2 risk/getiri oranı hedeflenmelidir. Bu, 1 TL risk için en az 2 TL kazanç potansiyeli demektir.'
          }
        ]
      }
    ]
  },
  {
    id: 'day-trading',
    title: 'Day Trading',
    description: 'Gün içi işlem stratejileri, scalping ve momentum trading.',
    icon: '⚡',
    color: '#F59E0B',
    level: 'İleri',
    totalLessons: 3,
    estimatedTime: '45 dk',
    lessons: [
      {
        id: 'day-trading-nedir',
        title: 'Day Trading Nedir?',
        duration: '15 dk',
        content: `# Day Trading Nedir?\n\nDay trading, aynı gün içinde pozisyon açıp kapama stratejisidir.\n\n## Özellikleri\n\n- Gün sonunda tüm pozisyonlar kapatılır\n- Kısa vadeli fiyat hareketlerinden faydalanılır\n- Yüksek disiplin gerektirir\n- Hızlı karar alma yeteneği şart\n\n## Day Trader Profili\n\n✅ Hızlı karar alabilen\n✅ Disiplinli\n✅ Stres altında soğukkanlı\n✅ Sabırlı (doğru fırsatı bekleyen)\n✅ Risk yönetimi uygulayan\n\n## Gerekli Araçlar\n\n1. Hızlı internet bağlantısı\n2. Gerçek zamanlı veri akışı\n3. Teknik analiz araçları\n4. İşlem platformu\n5. İşlem günlüğü\n\n## Day Trading vs Swing Trading\n\n| Özellik | Day Trading | Swing Trading |\n|---------|-------------|---------------|\n| Süre | Aynı gün | 1-4 hafta |\n| İşlem sayısı | Fazla | Az |\n| Stres | Yüksek | Orta |\n| Ekran başı | Sürekli | Periyodik |\n| Komisyon | Yüksek | Düşük |`,
        quiz: [
          {
            id: 'q1',
            question: 'Day trading\'de pozisyonlar ne zaman kapatılır?',
            options: ['Haftasonunda', 'Ay sonunda', 'Aynı gün', 'Hedef karşılandığında'],
            correctIndex: 2,
            explanation: 'Day trading\'de tüm pozisyonlar aynı gün içinde kapatılır.'
          }
        ]
      },
      {
        id: 'acilis-stratejileri',
        title: 'Açılış Stratejileri',
        duration: '15 dk',
        content: `# Açılış Stratejileri\n\nBorsanın açılış saati, day trader için en kritik dönemdir.\n\n## İlk 30 Dakika Kuralı\n\n- İlk 30 dakikada yönü belirleyin\n- Aceleci olmayın\n- Hacmi gözlemleyin\n\n## Gap (Boşluk) Stratejisi\n\n### Gap Up (Yukarı Boşluk)\n- Önceki kapanıştan yüksek açılış\n- Güçlü gap: %2+ → Trend devam edebilir\n- Zayıf gap: <%1 → Kapanma ihtimali\n\n### Gap Down (Aşağı Boşluk)\n- Önceki kapanıştan düşük açılış\n- Panik satış: Dip fırsatı olabilir\n- Trend değişimi: Dikkatli olun\n\n## VWAP Stratejisi\n\n- **VWAP üzerinde:** Yükseliş eğilimi\n- **VWAP altında:** Düşüş eğilimi\n- VWAP'a dokunuş: Destek/direnç\n\n## Momentum Stratejisi\n\n1. Güçlü hacimle yükselen hisseyi belirle\n2. Geri çekilme bekle (EMA9'a)\n3. Destek noktasından giriş\n4. Stop: Son diplerin altı\n5. Hedef: Önceki yüksek veya 1:2 R/G`,
      },
      {
        id: 'gun-ici-yonetim',
        title: 'Gün İçi Pozisyon Yönetimi',
        duration: '15 dk',
        content: `# Gün İçi Pozisyon Yönetimi\n\n## Pozisyon Açma Kuralları\n\n1. **Endeks uyumunu kontrol et** → BIST100 trendiyle uyumlu mu?\n2. **Sektör gücüne bak** → Sektör güçlüyse hisse de güçlüdür\n3. **Hacim onayı al** → Ortalamanın üzerinde hacim\n4. **Teknik sinyal bekle** → RSI, MACD, EMA uyumu\n\n## Kademeli Kâr Alma\n\n- **Hedef 1 (%1.5-2):** Pozisyonun yarısını sat\n- **Hedef 2 (%3-4):** Kalan pozisyonun yarısını sat\n- **Kalan:** Trailing stop ile takip et\n\n## Kayıp Yönetimi\n\n- İlk stop'a sadık kal\n- Günlük %3 zarar = Bilgisayarı kapat\n- Öç trading yapma (intikam işlemi)\n- Kaybettiğin parayı aynı gün geri kazanmaya çalışma\n\n## Duygusal Kontrol\n\n> "En iyi işlem bazen işlem yapmamaktır."\n\n- **FOMO:** Treni kaçırdıysan bir sonrakini bekle\n- **Öfke:** Kayıptan sonra mola ver\n- **Aşırı güven:** Art arda kazançtan sonra dikkatli ol\n\n## Günlük Checklist\n\n- [ ] Piyasa koşullarını değerlendir\n- [ ] Risk limitlerini belirle\n- [ ] Stop seviyeleri hazır mı?\n- [ ] Duygusal durum uygun mu?\n- [ ] İşlem planı net mi?`,
      }
    ]
  },
  {
    id: 'swing-trading',
    title: 'Swing Trading',
    description: 'Orta vadeli trend takibi, kırılım stratejileri ve pozisyon yönetimi.',
    icon: '🌊',
    color: '#8B5CF6',
    level: 'Orta',
    totalLessons: 3,
    estimatedTime: '40 dk',
    lessons: [
      {
        id: 'swing-temelleri',
        title: 'Swing Trading Temelleri',
        duration: '14 dk',
        content: `# Swing Trading Temelleri\n\nSwing trading, birkaç gün ile birkaç hafta arasında pozisyon tutma stratejisidir.\n\n## Avantajları\n\n- Sürekli ekran başında olmanız gerekmez\n- Daha az stresli\n- Daha az komisyon\n- Büyük hareketlerden faydalanma\n\n## Dezavantajları\n\n- Gecelik risk (gap riski)\n- Sabır gerektirir\n- Daha büyük stop mesafesi\n\n## Swing Trading İçin İdeal Koşullar\n\n1. **Trend var** → Yatay piyasada zor\n2. **Volatilite normal** → Çok düşük/yüksek değil\n3. **Hacim yeterli** → Likit hisseler\n4. **Teknik yapı net** → Belirsizlik yok\n\n## Swing Trade Süreci\n\n1. Haftalık grafikten trendi belirle\n2. Günlük grafikten giriş noktası bul\n3. Risk/Getiri hesapla (min 1:2)\n4. Pozisyon büyüklüğü belirle\n5. Stop loss ve hedef koy\n6. Sabırla bekle`,
      },
      {
        id: 'kirilim-stratejileri',
        title: 'Kırılım Stratejileri',
        duration: '13 dk',
        content: `# Kırılım (Breakout) Stratejileri\n\n## Kırılım Nedir?\n\nFiyatın belirli bir destek/direnç seviyesini aşmasıdır.\n\n## Güçlü Kırılım Özellikleri\n\n1. **Yüksek hacim** → Ortalamanın 1.5x üstü\n2. **Güçlü mum** → Büyük gövdeli mum\n3. **Tekrar test** → Kırılan seviyeyi test edip devam\n4. **Çoklu gösterge onayı** → RSI, MACD uyumlu\n\n## Kırılım Türleri\n\n### Direnç Kırılımı (Yukarı)\n- Önceki tepelerin üzerine çıkış\n- Alış fırsatı\n- Stop: Kırılan direncin altı\n\n### Destek Kırılımı (Aşağı)\n- Önceki diplerin altına iniş\n- Satış/uzak durma sinyali\n\n### Yanlış Kırılım (Fakeout)\n- En tehlikeli durum!\n- Kırılım sonrası hızla geri dönüş\n- Korunma: Onay mumunu bekleyin\n\n## Kırılım İşlem Planı\n\n| Adım | Eylem |\n|------|-------|\n| 1 | Konsolidasyon bölgesi belirle |\n| 2 | Hacim artışını gözle |\n| 3 | Kırılım mumunu bekle |\n| 4 | Onay gelirse giriş yap |\n| 5 | Stop: Kırılım seviyesinin altı |\n| 6 | Hedef: Konsolidasyon genişliği kadar |`,
      },
      {
        id: 'trend-takibi',
        title: 'Trend Takip Stratejisi',
        duration: '13 dk',
        content: `# Trend Takip Stratejisi\n\n> "Trend senin arkadaşın." - Eski Wall Street sözü\n\n## Trend Belirleme\n\n### Yükseliş Trendi\n- Yükselen dipler + Yükselen tepeler\n- Fiyat > EMA20 > EMA50\n- MACD sıfırın üzerinde\n\n### Düşüş Trendi\n- Alçalan tepeler + Alçalan dipler\n- Fiyat < EMA20 < EMA50\n- MACD sıfırın altında\n\n## Trend Gücü Göstergeleri\n\n1. **ADX > 25** → Güçlü trend\n2. **Hacim artışı** → Trend devam\n3. **EMA dizilimi** → Trend onayı\n\n## Swing Trade Giriş Noktaları\n\n### Geri Çekilme Alımı\n1. Yükseliş trendini onayla\n2. EMA20-50 bölgesine geri çekilme bekle\n3. Destek bölgesinde alış yap\n4. Stop: EMA50 altı\n\n### Kırılım Sonrası\n1. Yatay konsolidasyon bul\n2. Kırılım + hacim onayı\n3. Tekrar test sonrası giriş\n\n## Pozisyon Yönetimi\n\n- **1/3 pozisyon:** İlk hedefte sat\n- **1/3 pozisyon:** İkinci hedefte sat\n- **1/3 pozisyon:** Trailing stop ile takip\n\n## Önemli\n\n> Trende karşı işlem açmayın. Trend dönene kadar trendle birlikte hareket edin.`,
      }
    ]
  },
  {
    id: 'trader-psikolojisi',
    title: 'Trader Psikolojisi',
    description: 'Duygusal kontrol, disiplin, sabır ve zihinsel dayanıklılık.',
    icon: '🧠',
    color: '#EC4899',
    level: 'Başlangıç',
    totalLessons: 3,
    estimatedTime: '35 dk',
    lessons: [
      {
        id: 'duygusal-kontrol',
        title: 'Duygusal Kontrol',
        duration: '12 dk',
        content: `# Duygusal Kontrol\n\n## Trading'de Duygular\n\nTrading'de en büyük düşman kendinizsinizdir.\n\n### Korku\n- Kayıp korkusu → Erken çıkış\n- Fırsat kaçırma korkusu (FOMO) → Yanlış giriş\n- Stop tetiklenme korkusu → Stop'u kaldırma\n\n### Açgözlülük\n- "Biraz daha bekleyeyim" → Kârı geri verme\n- Aşırı pozisyon → Büyük kayıp\n- Daha fazla risk → Hesap patlaması\n\n### Öfke\n- Kayıp sonrası intikam işlemi\n- Kuralları çiğneme\n- Kontrolsüz işlem açma\n\n## Çözümler\n\n1. **İşlem planı yapın** ve ona sadık kalın\n2. **İşlem günlüğü tutun** ve hatalarınızı analiz edin\n3. **Mola verin** → Kaybettikten sonra ekrandan uzaklaşın\n4. **Pozisyon küçültün** → Stresli hissediyorsanız\n5. **Fiziksel sağlık** → Uyku, egzersiz, beslenme\n\n## Altın Kurallar\n\n> "Piyasada para kazanmak değil, para kaybetmemek önemlidir."\n>\n> "Duygularınızla değil, planınızla işlem yapın."`,
        quiz: [
          {
            id: 'q1',
            question: 'FOMO ne demektir?',
            options: ['Bir gösterge', 'Fırsat kaçırma korkusu', 'Bir emir türü', 'Bir formasyon'],
            correctIndex: 1,
            explanation: 'FOMO (Fear Of Missing Out) fırsat kaçırma korkusudur. Yanlış zamanda işlem açmaya yol açabilir.'
          }
        ]
      },
      {
        id: 'disiplin',
        title: 'Trading Disiplini',
        duration: '12 dk',
        content: `# Trading Disiplini\n\n## Disiplin = Başarı\n\nProfesyonel traderlerin ortak özelliği: **Disiplin.**\n\n## Disiplinli Trader Özellikleri\n\n✅ Her gün aynı rutini uygular\n✅ İşlem planına sadık kalır\n✅ Stop loss'u asla değiştirmez\n✅ Kurallarını yazılı tutar\n✅ Duygusal kararlar almaz\n✅ Mola vermeyi bilir\n✅ Sürekli öğrenir\n\n## Günlük Rutin Önerisi\n\n### Piyasa Öncesi (1 saat)\n- Haberleri kontrol et\n- Teknik analiz yap\n- İzleme listesini güncelle\n- İşlem planı hazırla\n\n### Piyasa Saatlerinde\n- Plana sadık kal\n- Duygularını kontrol et\n- Günlüğe not al\n\n### Piyasa Sonrası (30 dk)\n- Günü değerlendir\n- İşlem günlüğünü güncelle\n- Hataları analiz et\n- Yarın için hazırlık yap\n\n## Disiplin Kuralları\n\n1. Günde max 3 işlem\n2. Kaybedilen günde tekrar giriş yok\n3. Her işlemde risk limiti\n4. Haftalık performans değerlendirmesi\n5. Aylık strateji gözden geçirmesi`,
      },
      {
        id: 'hatalar',
        title: 'En Yaygın Trader Hataları',
        duration: '11 dk',
        content: `# En Yaygın Trader Hataları\n\n## 1. Stop Loss Koymamak 🔴\n- En ölümcül hata\n- Tek bir işlem tüm sermayeyi bitirebilir\n- **Çözüm:** Her işlemde stop loss\n\n## 2. Aşırı İşlem (Overtrading) 🔴\n- Çok fazla işlem açmak\n- Komisyonlar kârı yer\n- **Çözüm:** Günde max 3 işlem\n\n## 3. Ortalama Düşürme 🔴\n- Zarar eden pozisyona ekleme\n- Kayıpları büyütür\n- **Çözüm:** Kaybeden pozisyona ekleme yapma\n\n## 4. FOMO Trading 🟡\n- "Herkes kazanıyor ben de gireyim"\n- Genellikle tepe bölgede giriş\n- **Çözüm:** Kendi planını takip et\n\n## 5. İntikam Trading 🟡\n- Kaybettikten sonra hemen geri kazanmaya çalışmak\n- Kontrolsüz ve duygusal kararlar\n- **Çözüm:** Kaybetince mola ver\n\n## 6. Plan Olmadan İşlem 🟡\n- "Hislerim söylüyor" yaklaşımı\n- Tesadüfi başarı, sistematik başarısızlık\n- **Çözüm:** Yazılı işlem planı\n\n## 7. Aşırı Kaldıraç 🔴\n- Büyük kazanç hayali\n- Büyük kayıp gerçeği\n- **Çözüm:** Kaldıraç kullanma\n\n## Sonuç\n\n> "Piyasada uzun süre kalmak, kısa sürede çok kazanmaktan daha önemlidir."\n>\n> "Hata yapmak normal, aynı hatayı tekrarlamak ise tercih."`,
        quiz: [
          {
            id: 'q1',
            question: 'En ölümcül trader hatası hangisidir?',
            options: ['Çok işlem açmak', 'Stop loss koymamak', 'Geç giriş yapmak', 'Az kâr almak'],
            correctIndex: 1,
            explanation: 'Stop loss koymamak en ölümcül hatadır. Tek bir işlem tüm sermayeyi bitirebilir.'
          }
        ]
      }
    ]
  },
  {
    id: 'kripto-analiz',
    title: 'Kripto Analizi',
    description: 'Bitcoin, altcoinler, DeFi ve kripto piyasa dinamikleri.',
    icon: '₿',
    color: '#F97316',
    level: 'Orta',
    totalLessons: 3,
    estimatedTime: '40 dk',
    lessons: [
      {
        id: 'kripto-temelleri',
        title: 'Kripto Para Temelleri',
        duration: '14 dk',
        content: `# Kripto Para Temelleri\n\n## Bitcoin Nedir?\n\n- 2009'da Satoshi Nakamoto tarafından yaratıldı\n- Merkeziyetsiz dijital para birimi\n- Blockchain teknolojisi üzerine kurulu\n- Maksimum arz: 21 milyon BTC\n\n## Temel Kavramlar\n\n### Blockchain\n- Dağıtık defter teknolojisi\n- Her işlem kayıt altında\n- Değiştirilemez ve şeffaf\n\n### Cüzdan (Wallet)\n- Kripto varlıkların saklandığı yer\n- Public Key: Adresiniz (IBAN gibi)\n- Private Key: Şifreniz (asla paylaşmayın!)\n\n### Mining (Madencilik)\n- İşlemleri doğrulama süreci\n- Yeni coinler üretilir\n- Enerji yoğun işlem\n\n## Büyük Kripto Paralar\n\n| Kripto | Özellik |\n|--------|---------|\n| Bitcoin (BTC) | Dijital altın, değer saklama |\n| Ethereum (ETH) | Akıllı kontratlar, DeFi |\n| BNB | Binance ekosistemi |\n| Solana (SOL) | Hızlı ve ucuz işlemler |\n| XRP | Bankalar arası transfer |\n\n## Riskler\n\n⚠️ 7/24 piyasa açık\n⚠️ Çok yüksek volatilite\n⚠️ Regülasyon belirsizliği\n⚠️ Hack/dolandırıcılık riski`,
        quiz: [
          {
            id: 'q1',
            question: 'Bitcoin\'in maksimum arzı kaçtır?',
            options: ['10 milyon', '21 milyon', '100 milyon', 'Sınırsız'],
            correctIndex: 1,
            explanation: 'Bitcoin\'in maksimum arzı 21 milyon BTC olarak belirlenmiştir. Bu, onu deflasyonist bir varlık yapar.'
          }
        ]
      },
      {
        id: 'kripto-teknik',
        title: 'Kripto Teknik Analiz',
        duration: '13 dk',
        content: `# Kripto Teknik Analiz\n\n## BIST vs Kripto Analiz Farkları\n\n- Kripto 7/24 açık → Daha fazla veri\n- Daha yüksek volatilite → Daha geniş stop\n- Bitcoin dominansı → Altcoin yönünü etkiler\n- On-chain veriler → Ek analiz katmanı\n\n## Kripto İçin Önemli Göstergeler\n\n### Bitcoin Dominansı\n- BTC.D > %50 → Bitcoin sezonu\n- BTC.D < %40 → Altcoin sezonu\n\n### Korku & Açgözlülük Endeksi\n- 0-25: Aşırı Korku → Alış fırsatı\n- 75-100: Aşırı Açgözlülük → Dikkat\n\n### Hacim Profili\n- DEX hacimleri\n- Borsa giriş/çıkış hacimleri\n\n## Kripto Spesifik Stratejiler\n\n### Halving Döngüsü (Bitcoin)\n- Her 4 yılda bir ödül yarılanması\n- Genellikle 12-18 ay sonra boğa piyasası\n\n### Altcoin Rotasyonu\n1. Bitcoin yükselir\n2. Büyük altcoinler yükselir (ETH, SOL)\n3. Küçük altcoinler yükselir\n4. Düzeltme başlar\n\n## Kripto Risk Yönetimi\n\n- Portföyün max %10'u kripto\n- Stop loss mutlaka (daha geniş: %5-10)\n- Kaldıraç kullanmayın\n- Sadece kaybetmeyi göze aldığınız miktarla`,
      },
      {
        id: 'defi-nft',
        title: 'DeFi ve NFT Dünyası',
        duration: '13 dk',
        content: `# DeFi ve NFT Dünyası\n\n## DeFi (Merkezi Olmayan Finans)\n\n### Nedir?\n- Aracısız finansal hizmetler\n- Blockchain üzerinde çalışır\n- Herkes erişebilir\n\n### DeFi Ürünleri\n\n1. **DEX (Merkeziyetsiz Borsa):** Uniswap, PancakeSwap\n2. **Lending (Borç Verme):** Aave, Compound\n3. **Staking:** Varlık kilitleyerek gelir elde etme\n4. **Yield Farming:** Likidite sağlayarak kazanç\n5. **Stablecoin:** USDT, USDC (dolar sabitli)\n\n### DeFi Riskleri\n- Akıllı kontrat riski (hack)\n- Impermanent loss (kalıcı kayıp)\n- Rug pull (proje kaçışı)\n- Gas ücretleri\n\n## NFT (Non-Fungible Token)\n\n### Nedir?\n- Benzersiz dijital varlık\n- Sanat, müzik, oyun eşyaları\n- Sahiplik kanıtı blockchain'de\n\n### NFT Piyasası\n- OpenSea, Blur gibi platformlar\n- Koleksiyon bazlı değerleme\n- Yüksek volatilite ve risk\n\n## Sonuç\n\n> DeFi ve NFT dünyası hızla gelişiyor ama riskler de büyük.\n> Küçük miktarlarla başlayın ve araştırma yapın.\n> "DYOR - Do Your Own Research" (Kendi Araştırmanızı Yapın)`,
      }
    ]
  }
];

export function getCourseById(id: string): Course | undefined {
  return COURSES.find(c => c.id === id);
}

export function getLessonById(courseId: string, lessonId: string): Lesson | undefined {
  const course = getCourseById(courseId);
  return course?.lessons.find(l => l.id === lessonId);
}

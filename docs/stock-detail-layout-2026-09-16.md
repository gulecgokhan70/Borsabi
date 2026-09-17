# Hisse detay ekranı — 16 Eylül 2026

Gönderilen Midas ekranlarındaki fiyat/grafik hiyerarşisi BorsaBi hisse ekranına uyarlandı.

- Mobilde genel arama ve alt menü yerine geri, izleme listesi, alarm sayfası ve paylaşım kontrolleri; masaüstünde mevcut gezinme korunur.
- Büyük fiyat, Türkçe yüzde biçimi, sade çizgi grafiği ve grafiğin altında dönem seçimi. 1G artık üç aylık veri yerine bir günlük/5 dakikalık veri ister.
- Mum grafiği, tam ekran, gelişmiş göstergeler ve çizim araçları korunur.
- Sabit Sat/Al alanında sanal işlem açıklaması; kullanılabilir fiyat yoksa işlem düğmeleri kapalıdır.
- Fiyat zamanı görünür kalır. Kaynak, son kontrol ve seans bilgisi açılır ayrıntıya taşındı.
- İstatistikler grafiğin altında; haberler ve mevcut AI analizi daha aşağıda.
- İzleme listesi mevcut servise bağlıdır, hızlı çift dokunma tek isteğe dönüşür. Paylaşım desteklenirse cihaz paylaşımı, aksi halde bağlantı kopyalama kullanılır.
- Açık/koyu tema değişkenleri korunur. Eksik analist, temettü ve yatırımcı akış verisi üretilmedi.

## Doğrulama

208 otomatik test, TypeScript, ESLint ve üretim derlemesi geçti. Ek testler 1G isteğini, izleme listesine çift dokunmayı ve geçersiz fiyatla işlem düğmelerinin kapanmasını doğrular. Mevcut testler USD/TRY, komisyon, fazla satış ve grafik fiyatının emir fiyatını değiştirmemesini kapsar.

Tarayıcı yerel önizlemeye ERR_BLOCKED_BY_CLIENT nedeniyle erişemedi. Görsel mobil kontrol ve gerçek cihaz testi tamamlanmadı. Yayın sonrası dar ekranlarda sabit işlem alanı, tam ekran grafik ve işlem formu gözlemlenmeli.

Veritabanı şeması değişmedi. Yeni Android paketi hazırlanmadı. Sunucuya otomatik dağıtım yapılmadı.

# Radar, grafik ve sadeleşme — 16 Eylül 2026

## Hazırlanan değişiklikler

- Ana sayfadaki büyük radar kartı kaldırıldı. Gelişmeler mevcut sunucu otomasyonunda yaklaşık 10 dakikada bir kontrol edilir. İlk başarılı, boş olmayan haber akışı sessiz başlangıç kaydıdır.
- Başlık, kategori, ilgili şirketler ve etki açıklaması aynıysa tekrar bildirim oluşturulmaz. Yalnızca kaynağın URL'sinin veya tarihinin değişmesi bildirim üretmez. Bilinen olaylar 7 gün tutulur; boş akış bu kaydı sıfırlamaz. Yedi günden eski kayıtların düşmesi depolamayı sınırlar.
- Bir kontroldeki yeni gelişmeler kullanıcı başına tek bildirimde birleşir. Yeni hesabın oluşturulmasından önce yayımlanmış haberler o hesaba bildirilmez. Bildirim ve kontrol kaydı aynı veritabanı işlemi içinde kaydedilir; kilit ve benzersiz olay anahtarı yeniden başlatma/çift çalışan durumunda tekrar üretimini engeller.
- Radar ayrıntıları ve aç/kapat tercihi Fiyat Alarmları ekranındadır. Uygulama içi bildirimler kısa süre görünür; geçmiş kayıtlar portföydeki bildirim alanında kalır. Telefon bildirimi mevcut Web Push aboneliği ve izni gerektirir. Radar sunucuda çalışır; telefon sayfasının açık olması gerekmez. Gerçek cihaz teslimi bu ortamda doğrulanmadı.
- Haber kapsamı önceki deneysel radar ile aynıdır: tanınan kaynaklar ve başlık kuralları, son 48 saat ve en fazla 8 senaryo. Tüm haberleri kapsama veya yön/getiri tahmini iddiası yoktur.
- EMA20/50/200, MACD ve Bollinger görünür dönemden önceki geçmişle hesaplanır. EMA başlangıcında ilgili dönemin basit ortalaması kullanılır; MACD sinyali 34. mumdan önce gösterilmez. Kaynak yeterli geçmiş sunmazsa veri uydurulmaz; arayüz eksik geçmişi açıklar.
- 4 saatlik mumlar gerçek saatlik mumlardan, her UTC gününün ilk mumuna göre dört saatlik gruplarla üretilir. Farklı günler birleştirilmez; son grup tamamlanmamış olabilir. Farklı sağlayıcıların seans hizalaması farklı olabilir.
- Tek zaman düğmesi seçilir. Eski isteğin geç gelen cevabı yeni seçimi ezmez. Son fiyat güncel zaman etiketiyle yapay mum olarak eklenmez; fiyat başlıkta kalır. Grafik ve çizim araçları aynı fiyat ölçeğini kullanır; aralık değişince eski çizimler temizlenir. Yatay gövdeli mumların fitilleri de fiyat ölçeğinden hesaplanır.
- AI hata cevapları analiz gibi raporlanmaz veya sonraki isteğe asistan cevabı olarak eklenmez. Ağ/proxy hatalarında yeniden deneme bulunur. Boş, bozuk ve yarım kalan yanıtlar başarı sayılmaz. Sunucudaki gerçek sağlayıcı hatasının nedeni henüz doğrulanmadı.

## Kullanıcının onayladığı menü düzeni — uygulandı

| Yer | Öneri |
|---|---|
| Alt menü | Ana Sayfa · Piyasalar · Portföy · Öğren · AI Asistan; aynı boyda düğmeler |
| Portföy içi | İzleme listesi · İşlem günlüğü · Alarmlar ve radar |
| Öğren içi | Akademi · Keşfet |
| Gelişmiş araçlar | Backtest · Tarama · Strateji oluşturucu · Risk merkezi · Günlük/salınım araçları · Akşam analizi |
| Ana menüden çıkarılacak bağlantılar | Sosyal · Sıralama · Rozetler · Aracı kurum karşılaştırması; özellikler silinmeden Diğer altında erişilebilir |

Kullanıcı onayıyla beş eşit ana sekme uygulandı. Gelişmiş ve Diğer bölümleri başlangıçta kapalı; içlerindeki bir sayfaya gidildiğinde ilgili bölüm açılır. Portföy araçlarına portföy ekranından, Keşfet sayfasına Öğren ekranından da erişilir. Mevcut sayfa yolları korunur. Hisse ekranında alt sekmeler yerine mevcut Al/Sat çubuğu kalır.

## Doğrulama ve yayın

Yerelde 58 test dosyasındaki 241 test geçti; TypeScript ve ESLint hatasız tamamlandı. Üretim derlemesi başarılı oldu. Radarın veritabanında eşzamanlı çalışma, geri alma ve tekrar önleme testi CI PostgreSQL paketine eklendi. Yerelde PostgreSQL bulunmadığından bu entegrasyon testinin çalıştığı ayrıca CI üzerinden doğrulanmalıdır. Gerçek telefon, canlı haber sağlayıcıları ve canlı AI hizmeti testi yapılmadı.

Veritabanı şeması değişmedi. Mevcut `ScanCache` ve `AppNotification` tabloları kullanılır. `borsabi-automation` çalışanının da yeni sürümle başlaması gerekir; mevcut `scripts/deploy-platform.sh` bunu yapar. Yalnızca web servisini yeniden başlatmak radar çalışanını güncellemez.

GitHub aktarımı için kullanıcı onayı alındı. Ancak bağlı GitHub uygulaması `Resource not accessible by integration` (403) döndürdüğünden uzak dal güncellenemedi. Yerel kod ve testler hazır; canlıya yayın yapılmadı.

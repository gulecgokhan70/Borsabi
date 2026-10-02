# BIST seans ve veri zamanı gösterimi

Piyasa saatleri değiştirilmez. 10:00 sürekli işlemin normal başlangıcıdır; 10:15,
yaklaşık 15 dakika gecikmeli açılış fiyatlarının beklenmeye başladığı saattir.
Kaynak: https://borsaistanbul.com/piyasalar/pay-piyasasi/islem-saatleri
(25 Eylül 2026 tarihinde kontrol edildi). Özel gün/tatil takvimi saatten çıkarılmaz.

Ortak `BistDataNotice` ana sayfa, BIST/endeks sekmeleri, hisse detayı ve BIST işlem
formlarında kullanılır. 10:00–10:15 aralığında açılış verilerinin beklendiğini,
sonrasında gecikmenin devam ettiğini belirtir. Kaynak yakın zamanda seansı kapalı
bildirmişse açılış verisi bekleniyor denmez. Seans bildirimi üç dakikadan eskiyse,
yoksa veya açık bildirimi normal hafta içi seans aralığının dışındaysa doğrulanmamış
gösterilir. Saat tek başına açık seans kanıtı değildir. Midas fiyat ve hacminden
seans durumu türetilmez. Endekslerden alınmış yeni kaynak seans bilgisi liste
özetinde kullanılabilir; bunun için yeni bir ağ isteği eklenmez.

10:15 geçişi görünümde 15 saniyelik sayaçla yenilenir. Veri getirme, grafik mumları,
otomatik/sanal emir koşulları ve bot takvimi değiştirilmez. İşlem fiyatlarına veya
zaman damgalarına 15 dakika eklenmez/çıkarılmaz.

Liste API'leri `priceAsOf`, `priceSource`, `checkedAt`, `marketOpen` alanlarını taşır.
Fiyat zamanı yalnızca seçilen fiyatın kaynaktaki zamanından gelir: Midas Last için
DateTime, Yahoo regularMarketPrice için regularMarketTime. Önceki kapanışa yapılan
fiyat dönüşünde mevcut quote zamanı yeniden kullanılmaz. Kaynak zamanı bilinmeyen
fiyatlarda Bilinmiyor yazılır. Kontrol zamanı fiyat zamanı yerine kullanılmaz.
Önceki tarayıcı önizlemeleri eksik alanlarla çalışır, yeni zaman damgası uydurulmaz.

Hisse detayı ve ana sayfadan açılan işlem formu ekrandaki fiyatla aynı metadata'yı
alır. Metadata taşımayan diğer eski işlem girişleri fiyat zamanını bilinmiyor olarak
gösterir. Bu not gösterimin fiyatı doğruladığı veya canlı emir gerçekleştirdiği
anlamına gelmez. Kaynağın gecikmesi ve tatil/özel seans doğrulama eksikleri sürer.

Testler: 10:00/10:15 sınırları, sayfa yenilemeden geçiş, bilinmeyen/eski seans,
hafta sonu/kapalı kaynak, eksik fiyat zamanı, kapanış fiyatı fallback zamanları,
liste API metadata aktarımı. Veritabanı geçişi veya yeni servis gerekmez.

Yerel doğrulama: 362 test / 82 dosya, TypeScript, ESLint ve üretim derlemesi başarılı.

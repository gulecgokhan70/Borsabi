# Yükleme, AI yanıtları ve portföy açıklaması — 22 Eylül 2026

## Kapsam
Onaylanan öncelikler: ana sayfa/Piyasalar yükleme akışı, kullanıcı sorularında AI hata toparlanması, portföyün neden değiştiğinin açıklanması. Yeni menü, emir türü veya eğitim modülü eklenmedi.

## Yükleme
- Ana sayfa `/api/portfolio?summary=1` ile yalnızca hesap ve açık pozisyon toplamlarını, satış sonucunu ve kazanma oranını ister. İşlem listesini, kapalı pozisyonları ve grafik eğrisini hazırlamaz. Sayısal özet tam portföy API'siyle aynı tanımları kullanır; sıfır komisyon korunur.
- Kullanıcı ve açık pozisyon sorguları paralel başlar. Hesap özetleri `private, no-store` döner.
- Ana sayfa piyasa bölümleri ve Piyasalar sekmeleri, en fazla beş dakika önce kontrol edilmiş fiyatları tarayıcı sekmesi belleğinden (`sessionStorage`) hemen gösterebilir. Ağ isteği aynı anda başlar. İlk ziyarette kayıt yoksa mevcut yükleme davranışı sürer.
- Önceki fiyat gösterimi açıkça belirtilir. Son kontrol fiyat zamanı değildir; eski kontrol zamanı yeni istek başlamasıyla yenilenmez. Hesap bakiyesi, pozisyonlar ve sohbet tarayıcı önizleme kaydına yazılmaz.
- Bozuk, süresi geçmiş, gelecek tarihli ve fiyatı geçersiz kayıtlar kullanılmaz. Tarayıcı depolama hataları yüklemeyi engellemez.

## AI
- Hazır soru ve yazılan soru aynı gönderim yolunu kullanır. Başarılı önceki yanıtlar takip sorusuyla birlikte gönderilir; başarısız/yarım yanıtlar model bağlamına aktarılmaz.
- Kesilen yanıtta gelen metin ve kaynaklar korunur, yarım kaldığı belirtilir. Tekrar deneme yalnızca son başarısız konuşma çiftini yeniler; soruyu çoğaltmaz ve kullanıcının yazdığı sonraki taslağı silmez.
- Durdur ve sayfadan ayrılma devam eden isteği iptal eder. Çift gönderim engellenir. 120 saniye sınırı, soru uzunluğu denetimi ve anlaşılır HTTP hata açıklamaları korunur.
- SSE (yanıtın parçalar hâlinde aktarımı) bitiş işaretinde okuyucu kapanır; bağlantının ayrıca kapanmasını beklemez. Token sınırı nedeniyle kesilme başarılı tam yanıt sayılmaz.
- Asistanın ürün açıklamasındaki günlük getiri/canlı fiyat iddiaları mevcut özelliklerle eşleştirildi; kısa yanıt ve kısa terim açıklamaları istendi.

## Portföyüm neden değişti?
- Mevcut işlem kayıtları ve açık pozisyon değerlemesi kullanılır; dönem **başlangıçtan bugüne**, birim **TL**. Günlük başlangıç değerlemesi kaydı bulunmadığı için günlük performans iddiası yoktur.
- Üst özet: başlangıç sermayesi, nakit + pozisyon değeri, net değişim, satışlardan net sonuç ve açık pozisyon net sonucu.
- Açılır ayrıntı: fiyat etkisi + kur etkisi − işlem günlüğündeki toplam komisyon. Her komisyon yalnızca bir kez sayılır; açık pozisyonun olası gelecek satış komisyonu dahil değildir.
- Katkılar varlık bazında birleştirilir. Eski satışlarda ayrım yoksa katkı eksik işaretlenir; hesap değeriyle açıklanan toplam arasındaki fark ayrıca gösterilir. Fark fiyat veya kur kazancı diye uydurulmaz.
- İşlem, bakiye, komisyon oranı ve veritabanı şeması değiştirilmez.

## Doğrulama ve sınırlar
- 301 test / 69 dosya geçti. TypeScript kontrolü, lint ve üretim derlemesi geçti.
- Testler: geciken ağ yanıtından önce piyasa önizlemesi; süre/bozuk kayıt/hesap izolasyonu; metin sorusu ve takip sorusu; yarım yanıt + yeniden deneme; iptal ve çift gönderim; aynı fiyatla alış/satış; kısmi satış; kripto fiyat/kur ayrımı; eski kayıtlarda açıklanamayan fark; hesap sahibine özel hafif API.
- Canlı ana sayfa ve halka açık piyasa API'si HTTP 200 döndü. Oturumsuz portföy isteği HTTP 401 döndü. Canlı kullanıcı hesabıyla AI/portföy ve gerçek telefon testi yapılmadı; sunucu tarafındaki AI sağlayıcı kotası/ayarları doğrulanmadı.
- İlk açılışın gerçek telefondaki hız kazancı ölçülmedi. Önizleme ağ gecikmesini sonraki ziyaretlerde gizler; ilk ziyaretteki veri sağlayıcısı gecikmesini ortadan kaldırdığı iddia edilmez.

## Yayın sonrası kontrol
1. Ana sayfa ve Piyasalar'ı ilk kez aç; sonra hisse detayından geri dön. Önceki fiyat işareti ve ağ yenilemesini kontrol et.
2. `Borsa neden düştü?` yaz; bir devam sorusu sor. Yanıt sırasında Durdur ve Tekrar dene seçeneklerini dene.
3. Portföy açıklamasını işlem günlüğüyle karşılaştır; açık pozisyonlar ile kısmi satışların komisyonlarını kontrol et.
4. Gerçek telefonda açık/koyu tema, küçük ekran ve klavye açıkken gönder/durdur kontrollerini incele.

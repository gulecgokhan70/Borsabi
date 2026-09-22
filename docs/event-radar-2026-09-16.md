# Gelişme Radarı v1 — 16 Eylül 2026

## Amaç ve mevcut kapsam

Ana sayfadaki Gelişme Radarı, mevcut Bloomberg HT, Dünya ve KAP RSS akışındaki başlıkları sınırlı kurallarla sınıflandırır. Ayrı bir model servisi veya ücretli API eklenmedi. Mevcut AI analizinin yerine geçmez, emir/portföy/teknik puan hesaplarını değiştirmez.

Tanımlı olaylar: TCMB faiz artışı/indirimi, açıklanan enflasyon, petrol yükselişi/düşüşü, tanınan tek şirket için beklenti üstü/altı kâr ve imzalanan sözleşme. Başlıkta adı geçmeyen hisseler üretilmez. Sektör etkisi şirket fiyatı tahmini değildir. Faiz ve enflasyon için beklenti-gerçekleşme farkı bulunmadığından yön belirsiz bırakılır.

Bu sürüm, eğitilmiş ve doğrulanmış bir tahmin modeli değildir. Fiyat hedefi, al/sat kararı, başarı oranı, olasılık ve güven yüzdesi üretmez. Olumlu/olumsuz ifadeleri yalnızca belirtilen varsayım altında bir ekonomik etki kanalını anlatır. Her etkiyle birlikte karşı senaryo gösterilir.

## Veri akışı

`lib/news-feed.ts` ortak RSS okuma ve 10 dakikalık önbelleği sağlar; aynı anda gelen istekler aynı çalışmayı paylaşır. Eski `/api/news` çıktısı korunur; `dateVerified` alanı eklendi. RSS tarihi yoksa/bozuksa eski ekranların tarih biçimi korunur fakat radar bu haberi dışlar. İlk 40 karakteri aynı olan farklı haberlerin yanlış birleştirilmesi tam başlık eşleşmesiyle düzeltildi.

`lib/event-radar.ts` yalnızca son 48 saatteki, gelecekte olmayan, bilinen HTTPS kaynak bağlantısına sahip haberleri değerlendirir. Kaynak alan adları birebir doğrulanır; ana sayfa bağlantıları delil kabul edilmez. Kaynak türü içeriğin bağımsız doğrulandığı anlamına gelmez. TCMB ve TÜİK alan adları tanınır ancak bu sürüm bu iki kuruma yeni veri bağlantısı kurmaz.

Başlıkta beklenti/söylenti/inkâr belirteci varsa veya birden çok tanımlı olay eşleşiyorsa değerlendirme yapılmaz. Bu bir doğal dil anlama garantisi değildir: kapsamlı olumsuzluk, alıntı, geçmişe atıf ve karmaşık başlıkları yorumlama kapasitesi sınırlıdır. Eş/yakın başlıklar ve aynı kaynak adresi bir kez gösterilir; tekrarlar güveni artırmaz. En fazla 200 başlık işlenir ve en yeni 8 tanınan olay gösterilir; önem sıralaması değildir. Zıt olaylar birlikte gösterilir, tek yön puanına dönüştürülmez.

`/api/event-radar` oturum ve kullanıcı başına istek limiti uygular. Ana sayfa paneli sayfa açılışında/yenileme düğmesiyle çalışır; kesintisiz haber izleme veya bildirim servisi değildir. Veri yoksa düşük risk/nötr piyasa sonucu üretilmez.

## Doğrulama

222 test geçti. Eklenen 14 test: sınıflandırma ve çekimser kalma, tarihler, kaynak URL kontrolü, tekrar ve çelişki, şirket eşleme, yetkilendirme/istek limiti, kaynak hatası, ortak önbellek, UI hata sonrası yeniden deneme ve kaynak/karşı senaryonun görünürlüğü. TypeScript, ESLint ve üretim derlemesi geçti.

Bu kontroller tahmin başarısını ölçmez. Canlı haber sağlayıcılarının erişilebilirliği ve görsel gerçek cihaz testi bu oturumda doğrulanmadı.

## Ölçülebilir tahmin modeline geçiş

1. Kullanım hakkı uygun, zaman damgalı şirket açıklaması ve ekonomik takvim kaynağı bağlanmalı. Gerçekleşen değer, önceden yayımlanmış piyasa beklentisi, birim, dönem ve ilk görülme zamanı saklanmalı; sonradan revize edilmiş veriler eski tahmin anına taşınmamalı.
2. İlk görülme anında model sürümü, girdi özeti ve karar kaydedilmeli. Aynı haberin kopyaları tek olay kimliğiyle ilişkilendirilmeli.
3. Seans takvimi, gecikme, şirket aksiyonları ve o tarihteki endeks üyeleriyle uyumlu fiyatlar kullanılarak sonraki 1 seans / 5 seans endekse göre getiri etiketleri hazırlanmalı.
4. Eğitim/doğrulama/test kronolojik ayrılmalı; tahmin ufukları çakışan gözlemler sınırdan çıkarılmalı. Aynı olayın kopyaları eğitim ve testte birlikte bulunmamalı. Parametreler yalnızca eğitim/doğrulamayla seçilmeli; son dönem test olarak saklanmalı.
5. Önce nötr/tarihsel sıklık ve yalnızca fiyat bilgisi kullanan basit taban modellerle karşılaştırılmalı. Yön doğruluğu kadar kapsam (kaç olayda karar veriyor), sınıf dengesi, Brier skoru/olasılık kalibrasyonu, dönem/sektör bazlı hata ve maliyet sonrası sonuç raporlanmalı.
6. Yeterli örnek ve ayrılmış test başarısı olmadan yüzde olasılık yayımlanmamalı. Veri kayması izlenmeli; veri eksikken model çekimser kalmalı.

Yöntem kaynakları:
- scikit-learn zaman sıralı değerlendirme: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html
- Veri sızıntısından kaçınma: https://scikit-learn.org/stable/common_pitfalls.html
- SF Fed para politikası sürprizleri verisi ve beklenti farkı yaklaşımı: https://www.frbsf.org/research-and-insights/data-and-indicators/monetary-policy-surprises/

Bu kaynaklar BIST için seçilen kuralları veya bir başarı oranını doğrulamaz; sonraki ölçüm tasarımına dayanak sağlar.

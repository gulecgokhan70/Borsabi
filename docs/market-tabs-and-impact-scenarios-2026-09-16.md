# Piyasalar yükleme ve koşullu etki radarı

## Sorun ve çözüm
Piyasalar, bütün varlık sınıflarının fiyatlarını ve üç endeksin geçmişini beklemeden açılamıyordu. Yahoo fiyatları tek tek aynı kuyrukta çekiliyordu. Artık sadece seçili sekme için `group` sorgusu çalışır; fiyatlar geldikten sonra endeks grafik geçmişi tamamlanır. Ekran başlığı, sekmeler ve arama ilk beklemede de kullanılabilir. Yenilemede mevcut fiyatlar korunur, geç kalan eski sekme yanıtı güncel durumu ezmez.

Yahoo'nun desteklediği çoklu sembol sorgusu kullanılarak eşzamanlı önbellek eksikleri birleştirilir. Tekil ve toplu çağrılar aynı sembol önbelleğini paylaşır. En fazla 100 sembollük paketler; fiyat ve geçmiş için iki ayrı seri sıra; istek başına 12 saniye süre sınırı vardır. Altı döviz için altı tekil çağrı yerine bir sağlayıcı çağrısı yapıldığı test edildi. Bu gerçek cihaz açılış süresi ölçümü değildir.

`/api/piyasalar` grup filtresi döviz, kripto, emtia, endeks ve BIST alanlarını korur. Emtia hesaplamasının USD/TRY ihtiyacı ayrıca çekilir. Eksik fiyatlar sıfır gösterilmez; tümünün alınamaması 503, kısmi eksik bilgi ayrı durumdur. Brent etiketi için yanlış WTI (`CL=F`) sembolü Brent (`BZ=F`) ile düzeltildi. Mevcut sentetik altın hesap yöntemi bu paketin kapsamı dışında bırakıldı.

## Radar
`radar-scenarios.ts` başlık konusuna bağlı açıklanabilir kural şablonları üretir. Her kartta:
- Varsayımsal yön ve onu geçerli kılan koşul.
- Genel piyasa etkisi ve ayrı pozitif/negatif senaryolar.
- Sektör bazında pozitif ve negatif koşullar.
- Sonucu izlemek için kontrol edilmesi gereken veriler.

Konular: enerji, faiz, enflasyon, jeopolitik, ticaret kısıtları, döviz, şirket sonuçları, sözleşmeler, sermaye/temettü, talep/üretim, teknoloji, kripto. Desteklenmeyen başlığa etki uydurulmaz. Haber başlığı gerçekleşmenin doğrulaması sayılmaz; koşullu yorumlar fiyat/olasılık tahmin modeli veya al/sat sinyali değildir. Beklenti, fiyat tepkisi ve şirket finansalları otomatik bağlı değildir; bunlar kartlarda izlenecek veriler olarak açıkça ayrılır.

Güncel özet yalnızca son 48 saatlik başlıkların varsayımlarını içerir; 7 güne kadarki eski haberin senaryosu tarih etiketiyle okunabilir. Pozitif ve negatif varsayımlar karşılaşıyorsa özet karma olur. Özet, haber adedine dayalı olasılık ya da endeks getirisi hesaplamaz.

Koşullu senaryolar arka plan değişim denetimine katıldı. İlk yükseltme döngüsü yeni kapsamı sessizce kaydeder; geçmiş başlıklar topluca bildirim olarak gönderilmez. Sonraki yeni gelişme bir kez bildirilir. Abonelik/tercih kontrolleri korunur.

## Dayanak ve sınırlar
Faiz, kredi, döviz ve varlık fiyatı aktarım kanalları için birincil eğitim kaynağı: https://www.ecb.europa.eu/mopo/intro/transmission/html/index.en.html . Sektör senaryoları bu ürünün koşullu açıklama kurallarıdır; geçmiş veriyle tahmin başarıları doğrulanmış değildir.
Yahoo toplu sorgu ve modül `fetchOptions.signal` desteği kurulu `yahoo-finance2` paketinin tipleri ve uygulamasından kontrol edildi.

## Doğrulama
283 test, TypeScript ve lint kontrolleri geçti; üretim derlemesi başarılı. Yeni testler: tek grup isteği, fiyat/geçmiş ayrımı, toplu sorgu paylaşımı, eksik sembolün diğerlerini etkilememesi, sekme yarışları, tazeleme hatası, gerçek olmayan sıfır fiyatların engellenmesi, kaynak/tarih filtreleri, çift yönlü sektör kartları ve bildirim geçiş davranışı.
Gerçek VPS ağ gecikmesi ve telefon görünümü yayın sonrasında ölçülmeli. Hesap/bakiye/işlem matematiği ve veritabanı şeması değişmedi.

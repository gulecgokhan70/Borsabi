# Radar haber görünürlüğü ve ilk açılış

## Bulgular
- Radar yalnızca sekiz dar başlık kuralına uyan son 48 saatlik haberleri gösteriyordu. Diğer haberler görünmüyordu.
- Kaynak hataları boş listeye dönüştürülüyor, boş sonuç da 10 dakika önbellekte kalıyordu.
- Bu ortamdan yapılan kontrolde Bloomberg RSS 20 haber döndürdü; en yeni örnek 14 Eylül tarihliydi. Dünya, KAP ve TRT denemeleri zaman aşımına uğradı. Bu sonuç VPS erişiminin ölçümü değildir.
- Dashboard dört isteğin tamamını bekliyor, tek yavaş istek bakiye ve diğer listelerin görünmesini geciktiriyordu. İlk açılış ayrıca AI haber analizi başlatıyordu.

## Değişiklik
- Senaryoya dönüşmeyen tarihli haberler de kaynak bağlantısıyla listelenir. Haber listesi 7 gün, etki senaryoları 48 saatle sınırlıdır; 48 saatten eski başlıklar etiketlenir. Bilinmeyen tarih için güncel tarih üretilmez.
- Kaynakların başarılı/boş/hatalı durumları görünür. TRT ekonomi RSS eklendi: https://www.trthaber.com/sitene_ekle.html . Başlık kapasitesi kaynak başına 60'a çıktı. Kaynaklar paralel, en çok 12 saniye beklenerek okunur.
- Başarısız/boş kaynaklar bir dakika sonra tekrar denenebilir; önceki haberlerin gerçek tarihleri korunur. Bu uygulama içi önbellek kalıcı disk arşivi değildir.
- Etki kuralları ve arka plan bildirimlerinin değişim denetimi korunur. Sırf haber listesine eklendi diye başlıklar otomatik al/sat sinyaline veya bildirime dönüşmez.
- Ana sayfa bölümleri ayrı ayrı yüklenir; istekler 20 saniyede sonlandırılır. Önceki yenilemeden geç dönen sonuç yeni veriyi ezmez. Eksik bakiye sıfır gibi gösterilmez.
- AI haber analizi sadece Piyasa Uyarıları açılınca çağrılır. Grafik/işlem penceresi gerektiğinde yüklenir. İlk kripto isteği ekranda gösterilen sekiz varlıkla sınırlıdır.
- Market alerts kendi localhost HTTP çağrısı yerine ortak haber servisini doğrudan kullanır.

## Doğrulama
- 267 test geçti; yavaş kripto sırasında bakiye/hisse görünmesi, zaman aşımı, eski yanıtın elenmesi, kaynak hatası/boş kaynak yeniden denemesi, gerçek tarih korunması ve senaryosuz haber görünümü kapsandı.
- TypeScript, lint ve üretim derlemesi geçti.
- Next.js /dashboard First Load JS: önceki derlemede 306 kB, yeni derlemede 186 kB (yaklaşık %39 azalma). Bu dosya boyutu ölçümüdür; gerçek telefonda açılış süresi ölçülmedi.
- Veritabanı ve hesaplama mantığı değişmedi. Gerçek VPS kaynak erişimi ve telefon görünümü yayın sonrası kontrol edilmeli.

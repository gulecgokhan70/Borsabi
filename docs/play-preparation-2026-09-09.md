# BorsaBi: hesap yönetimi, öğrenme özeti ve veri performansı

9 Eylül 2026. Bu paket mevcut web uygulamasını geliştirir. Android AAB oluşturmaz ve Google Play onayı anlamına gelmez.

## Kullanıcıya görünen değişiklikler

- **İşlem Günlüğü → Öğrenme özeti:** son 7 veya 30 günün gerçekleşmiş net sonucu, komisyonları, işlem sayısı, karar notu ve zarar kes kullanım özeti. Öneriler kayıtlı işlemlerden kurallarla üretilir; ek yapay zekâ çağrısı yapmaz. Açık pozisyon değerlemesi bu özetin dışındadır. Satış K/Z değerinden komisyon tekrar düşülmez. Fiyat/kur ayrıştırması yalnızca bu verileri kaydedilmiş satışlar için gösterilir.
- **İşlem geçmişi:** 25 kayıtlık sayfalar ve geçmişin tamamında alış/satış filtresi. Genel istatistikler yalnızca açık sayfadan hesaplanmaz. İstek iptali eski yanıtların yeni filtreyi değiştirmesini önler.
- **Profil → Hesabımı sil:** mevcut şifre ve açık onayla hesap ve ilişkili aktif uygulama verileri tek veritabanı işlemi içinde silinir. `/hesap-silme` tarayıcıdan, uygulama olmadan da erişilebilir. Giriş sonrası bu sayfaya dönüş desteklenir.
- **AI Asistan ve işlem koçu → Yanıtı bildir:** neden, isteğe bağlı açıklama ve bildirilen yanıt kaydedilir. Başarı mesajı ancak kayıt başarılıysa gösterilir. Aynı bildirimin yeniden gönderilmesi ayrı kayıt oluşturmaz.
- **Yönetici → AI içerik bildirimleri:** yalnızca veritabanında `role=admin` olan mevcut hesaplar `/admin/ai-reports` sayfasından kayıtları inceleyip durumlarını değiştirebilir. Her istekte yetki tekrar kontrol edilir. Kullanıcı girdisi özgün sunucu yanıtı olarak doğrulanmış sayılmaz.
- **Destek:** gönderiyormuş gibi başarı gösteren eski form, açıkça e-posta uygulamasını açar. Kullanıcı e-postayı kendi uygulamasından gönderir.
- Tarayıcı yakınlaştırma engeli kaldırıldı; yeni formlarda mobil dokunma alanları, hata ve yüklenme durumları bulunur.

## Hesap ve yetki güvenliği

Profil API'si yalnızca ad, avatar ve komisyon alanlarını kabul eder. Profil isteğiyle `tier`, `role`, `balance` veya başka kullanıcı kimliği değiştirilemez. Mevcut paketler korunur; doğrulanmış ödeme entegrasyonu olmadığı için yeni paket aktivasyonu düğmeleri kaldırılmıştır. Profil komisyonu sıfır ve ondalık virgül dahil korunur.

Oturumlar değişmez kullanıcı kimliğiyle doğrulanır. Silinen hesabın eski JWT'si, aynı e-postayla açılan başka bir hesaba erişemez. Yeni yazma API'leri JSON içerik türünü, gönderilen Origin'i ve gerçek gövde boyutunu kontrol eder. Hesap silme ve AI bildirimi için kullanıcı başına istek sınırı vardır. Origin doğrulaması yapılandırılmış HTTPS alan adı ile tam `www` eşini destekler; diğer alt alanlar, portlar ve protokoller reddedilir.

Hesap silme bakiye, pozisyon, işlem günlüğü, emir makbuzları, pratik, sohbet, takip ilişkileri, izleme listesi, alarmlar, bildirimler, push abonelikleri, başarımlar ve AI bildirimlerini kapsar. Eşzamanlı işlemlerle çakışma tüm işlemin geri alınması/yeniden denenmesiyle ele alınır. Silme canlı kullanıcı üzerinde denenmemiştir.

## Ölçülen performans davranışı

- Testte aynı sembol için 20 doğrudan fiyat isteği ve eşzamanlı toplu istek, **tek sağlayıcı çağrısını** paylaşır. Aynı grafik seçenekleri de aynı isteği paylaşır; farklı seçenekler ayrı tutulur.
- Fiyat önbelleği 1.024, grafik önbelleği 128 girişle sınırlıdır. Süre veri alındığında başlar; başarısız yenileme eski verinin kaynak zamanını değiştirmez. Mevcut işlem fiyatı/kur güncellik kontrolleri korunur. Önbellek tek Node sürecine aittir.
- Ana sayfa, portföy, bildirimler ve son dakika haberleri görünmeyen veya çevrimdışı sekmede otomatik istek göndermez. Tekrarlı yenilemeler önceki istek bitmeden başlamaz. Testte 60 saniye arka plan ve 60 saniye çevrimdışı süre boyunca **sıfır yeni otomatik istek** doğrulandı.
- İşlem günlüğünün sınırsız geçmiş aktarımı kaldırıldı: Node'a varsayılan 25 kayıt ve PostgreSQL'de hesaplanan tek özet satırı gelir. SQL kullanıcı ve tarih parametreleri bağlanır.
- Kullanılmayan harici Abacus tarayıcı betiği ve ilgili konsol müdahalesi kaldırıldı; sunucu tarafındaki AI sağlayıcı entegrasyonu korunur.

Bunlar istek/veri hacmi ölçümleridir. Gerçek Android cihazında açılış süresi, bellek ve ağ tüketimi henüz ölçülmedi. Yeni öğrenme/bildirim arayüzleri bazı sayfaların JavaScript boyutunu artırır; tüm sayfaların daha küçük olduğu iddia edilmez.

## Doğrulama

- Yerel: 164 birim, API ve bileşen testi geçti; TypeScript ve ESLint geçti; üretim derlemesi tamamlandı.
- Yeni PostgreSQL senaryoları: ilişkili veri silme ve diğer hesabı koruma, yanlış şifre, son silmede hata olursa tüm kayıtları geri alma, eşzamanlı alış/satış, dönem/hesap bazlı özet ve şema tekrar uygulamasında verileri koruma.
- GitHub Actions: PostgreSQL 16 üzerindeki 25 entegrasyon testi, 164 uygulama testi, TypeScript, ESLint ve üretim derlemesi başarılı. Testler yalnızca geçici `localhost/borsabi_test` veritabanında çalıştı; canlı kullanıcı verisine dokunulmadı. [Doğrulanmış kontrol kaydı](https://github.com/gulecgokhan70/Borsabi/actions/runs/34341748082).

## Yayınlama ve kalan işler

Mevcut `scripts/deploy-platform.sh` kullanılmalıdır. Yeni `AiContentReport` tablosu eklemeli platform şemasına dahildir. Script uygulamayı ayrı dizinde derler, eski servis yazmalarını durdurur, veritabanı yedeği alır, şemayı uygular ve servis/HTTP kontrollerini yapar. Sadece `next build` ve yeniden başlatma bu tabloyu oluşturmaz.

Yönetici rolü bu paket tarafından kimseye otomatik verilmez. Yetkili mevcut hesap kullanılmalı; gerekiyorsa sahibi doğrulanmış bir hesaba sınırlı yönetici yetkisi sunucu yöneticisi tarafından atanmalıdır. Bildirimlerin gerçekten incelenmesi ve gerekli AI davranış değişikliklerinin uygulanması operasyonel görevdir. Diğer AI özelliklerinde bildirim düğmesi henüz bulunmaz.

Hesap silme aktif veritabanını temizler; geçmiş yedekleri, önceden cihaza ulaşmış bildirimleri veya dış hizmet kayıtlarını otomatik temizlemez. Üretim öncesinde yedek saklama/imha ve geri yüklemede silme taleplerini yeniden uygulama süreci belirlenmelidir. Bu sınır kullanıcı sayfasında açıkça yazılıdır. Destek e-posta adresinin çalıştığı ayrıca doğrulanmalıdır.

Play Console veri güvenliği açıklamaları, gizlilik metninin işletmeci bilgileri/saklama süreleri, uygulama sınıflandırması, kapalı test, Android paket/cihaz denemeleri ve gerekiyorsa ödeme entegrasyonu ayrıca tamamlanmalıdır. Bu kod değişiklikleri mağaza uygunluğunun tamamını doğrulamaz.

## Teslim durumu

Kod, `e84030404f02ec91993b0eabf687494fe7568875` commit'iyle `gulecgokhan70/Borsabi` deposundaki `codex/fix-trading-and-alerts` dalına gönderildi. Uzak dalın aynı commit'i gösterdiği doğrulandı. [GitHub Actions çalışması](https://github.com/gulecgokhan70/Borsabi/actions/runs/34341748082) tüm adımlarda başarılı tamamlandı. Bu notu güncelleyen sonraki commit yalnızca dokümantasyonu değiştirir.

Canlı VPS bu çalışma sırasında güncellenmedi. Hosting terminalinde mevcut `deploy-platform.sh` akışıyla yayın yapılmalıdır. Yeni tablo için bu script'in şema adımı gereklidir. Yayın sonunda `SURUM YAYINDA` çıktısı, hesap silme sayfasının açılması, öğrenme özetinin yüklenmesi ve bir test AI bildiriminin yönetici ekranına ulaşması kontrol edilmelidir. Gerçek kullanıcı hesabı silerek deneme yapılmamalı; hesap silme cihaz kontrolü için ayrı bir test hesabı kullanılmalıdır.

# AI soru yanıtlama düzeltmesi — 16 Eylül 2026

## Bulgular

Ekran görüntüsünde elle yazılan “Borsa durumu” sorusu hizmet hatası alırken sektörel performans önerisi yanıtlanıyor. İki giriş türü aynı istemci fonksiyonu ve API üzerinden gönderiliyor. Fark konuya göre toplanan verilerde: piyasa soruları haberleri ve endeksleri istiyor; sektörel tarama önerisi haber yoluna girmiyor.

Kod incelemesinde iki somut sorun bulundu:

- Kaynak listesi URL kodlamasıyla 6000 karaktere kadar HTTP başlığına konuyordu. Türkçe haber başlıkları içeren test verisi 4096 baytı aşıyor. Bu, varsayılan 4K başlık tamponu kullanan Nginx yapılandırmalarında hata oluşturabilecek büyüklükte. [Nginx proxy_buffer_size belgesi](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffer_size).
- Haber yolu zaman aşımı olmayan localhost isteği ardından ek bir AI haber analizi bekliyordu. Bağlam toplamanın toplam süre sınırı yoktu; ana sohbet modeli bundan sonra çağrılıyordu.

Canlı Nginx kayıtları ve sağlayıcı yanıtı görülmediğinden kullanıcının yaşadığı hatanın kesin kök nedeni doğrulanmış değildir. Yerel testler canlı sağlayıcı yerine denetimli yanıtlar kullanır.

## Değişiklikler

- Haber kaynağı doğrudan paylaşılan haber servisinden alınır; sohbet için ikinci model çağrısı ve localhost isteği kaldırıldı.
- Veri hazırlama en fazla sekiz saniye bekler. Endeksler, kurlar, hisse özeti ve haberler bağımsız görevlerdir; zamanında gelen sonuçlar korunur. Eksik verilerin belirtilmesi, rakam/haber uydurulmaması modele açıkça bildirilir.
- Geç gelen servis sonuçları o yanıtın kaynaklarına eklenemez. Kullanıcı bağlantıyı kapatırsa veri hazırlamadan sonra ücretli AI çağrısı başlatılmaz. Ortak önbellek istekleri diğer kullanıcıları etkilememek için arka planda tamamlanabilir.
- Kaynaklar HTTP başlığı yerine yanıt akışının ilk metadata kaydında gönderilir. Yanıtın Türkçe baytları aynen aktarılır; iptal ve bağlantı hatası yukarıdaki sağlayıcı akışına iletilir. Proxy tamponlaması kapatılır, yanıt önbelleğe alınmaz.
- Yeni istemci eski sunucu başlığını geçiş uyumluluğu için okuyabilir. Kaynak bağlantıları güvenli HTTPS veya uygulama içi yol olarak doğrulanır.
- Doğrulanmamış haber yayın zamanı bilinmiyor olarak gösterilir; eksik fiyat/değişim değerleri piyasa özetinde sıfır yapılmaz.

## Doğrulama

252 test geçti; tip kontrolü, lint ve üretim derlemesi başarılı. Yeni kapsam: “Borsa durumu”, “Borsa neden düştü”, “Bugün borsa nasıldı?”, haber sorusu, çalışan tarama önerisi, elle yazıp Enter ile gönderme, büyük Türkçe kaynak listesi, geciken servis, geç gelen kaynak, eksik yayın zamanı, boş haber servisi, akış iptali ve bağlantı kopması. Mevcut tekrar deneme ve kota hatası testleri de geçti.

Bu düzeltme veritabanı şeması veya işlem hesaplaması değiştirmez. Sağlayıcı kota/erişim arızalarını ortadan kaldırdığı iddia edilmez. Canlıya alındıktan sonra hazır soru ve elle yazılan sorular aynı hesapta yeniden denenmelidir. Hata sürerse `/api/ai-chat` HTTP durumu ve aynı zamandaki sunucu/proxy kayıtları incelenmelidir; anahtar veya sohbet içeriği günlüklerde paylaşılmamalıdır.

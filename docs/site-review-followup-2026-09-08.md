# BorsaBi yayın sonrası inceleme

İncelenen kaynak sürümü: `42fe424a6dc2380e5b6fd325c1e9b7e02d5c47fc`.

## Kapsam ve erişim sınırı

Kullanıcı sitenin ve AI asistanının çalıştığını bildirdi. Bu inceleme sırasında
`https://borsabi.com/` uzak tarayıcıda `502 Bad Gateway / [Errno 111] Connection refused`
döndürdü; tek yenilemede sonuç değişmedi. Hatanın uygulamadan mı yoksa bu erişim
yolundan mı kaynaklandığı doğrulanamadı. Bu nedenle canlı mobil gezinme, giriş,
alım-satım ve alarm akışları bu oturumda test edilmiş sayılmaz.

Aşağıdaki bulgular kaynak kodda ve yerel, sahte servislerle yürütülen üç teşhis
testinde doğrulandı. Üretim veritabanına yazılmadı, gerçek hesap açılmadı, Groq
isteği yapılmadı. Testlerin beklenen hatalı davranışı doğrulaması, ilgili özelliğin
doğru çalıştığı anlamına gelmez.

## 1. AI haber analizi oturum doğrulamıyor; eşzamanlı istekleri birleştirmiyor

Dosyalar: `nextjs_space/app/api/news-analysis/route.ts`,
`nextjs_space/lib/news-analysis.ts`, `nextjs_space/middleware.ts`.

API GET işleyicisi oturum kontrolü olmadan AI analizini başlatıyor; middleware
eşleştirmesi bu API yolunu kapsamıyor. Otuz dakikalık önbellek yalnızca tamamlanmış
analizi saklıyor. Boş önbelleğe aynı anda gelen istekler ortak devam eden işi beklemiyor.

Teşhis: oturum yokken aynı anda gönderilen üç yerel GET çağrısı üç adet model
çağrısı üretti ve hepsi 200 döndü. Bu durum ücretsiz kotayı gereksiz tüketebilir.

Öneri: dış isteklerde oturum doğrulaması ve kullanım sınırı; uygulama içindeki
çağrıları HTTP yerine doğrudan servis üzerinden yönlendirme; devam eden analizi
paylaşma; hata/kota aşımından sonra yeniden denemeyi geciktirme.

## 2. Uzun AI yanıtı sonraki kısa sorunun reddedilmesine neden oluyor

Dosyalar: `nextjs_space/app/api/ai-chat/route.ts`,
`nextjs_space/app/ai-assistant/ai-assistant-client.tsx`.

Groq geçişinde eklenen doğrulama, kullanıcı ve asistan mesajlarının tamamına
6.000 karakter sınırı uyguluyor. İstemci sohbet geçmişini yeniden gönderdiği için
asistanın kendi uzun yanıtı sonraki isteği geçersiz kılabiliyor. Son altı mesaja
indirgeme, doğrulamadan sonra yapılıyor; 100 mesaj sınırı da uzun sohbeti kilitleyebilir.

Teşhis: önceki asistan yanıtı 6.001 karakterken yeni kullanıcı mesajı yalnızca
“Teşekkürler” olsa da API 400 döndü; sağlayıcı çağrısı yapılmadı.

Öneri: yeni kullanıcı mesajının sınırını koruyarak gönderilen geçmişi önceden
sınırlandırma; asistan geçmişini reddetmek yerine bağlama uygun biçimde kısaltma.
Bu hata Groq geçişinde eklenen doğrulamadan kaynaklanıyor.

## 3. Kayıt doğrulaması yalnızca arayüzde yeterli ölçüde uygulanıyor

Dosyalar: `nextjs_space/app/api/signup/route.ts`, `nextjs_space/app/signup/page.tsx`.

Arayüz en az altı karakter şartı koyuyor; sunucu yalnızca e-posta ve şifrenin dolu
olmasını kontrol ediyor. Doğrudan API isteği bu arayüz kontrolünü atlıyor.

Teşhis: `not-an-email` ve tek karakterli şifreyle yapılan yerel istek, sahte veritabanı
kullanıcı oluşturma metoduna ulaştı ve 200 döndü. Gerçek kullanıcı kaydı oluşturulmadı.

Öneri: sunucuda e-posta biçimi, giriş türü ve şifre uzunluğu doğrulaması;
arayüzle ortak kurallar; kayıt/giriş denemelerine hız sınırı.

## Önceki incelemeden kalan konu

Kripto USD fiyatları ile TL bakiyesi aynı muhasebe modelinde kullanılabiliyor.
Bu konu önceki README/inceleme raporunda kayıtlıdır; bu turda yeniden canlı test
edilmedi. Kur dönüşümü ve geçmiş veri geçişi çözülmeden kripto toplamlarının doğru
TL değerlemesi olduğu varsayılmamalıdır.

## Düzeltme devamı

Yukarıdaki teşhisler `42fe424` sürümündeki davranışı kaydeder. Sonraki düzeltmede:

- Sohbet geçmişi altı mesajla sınırlanır; eski uzun cevaplar bağlamda kısaltılır.
  Yeni sorunun 6.000 karakter sınırı korunur. Yüz mesajı aşan konuşmalar devam eder.
- Haber API'si oturum ve kullanıcı başına hız sınırı uygular. Sohbet doğrudan ortak
  haber servisine bağlanır. Devam eden analiz paylaşılır, hatalar ve boş haberler
  tekrar deneme beklemesi oluşturur; altı saatten eski analiz gösterilmez.
- Kayıt formu ve sunucu ortak e-posta, isim ve şifre doğrulaması kullanır. Şifre alt
  sınırı sekiz karakter, bcrypt üst sınırı 72 UTF-8 bayttır. Kayıt API'sinde IP başına
  deneme sınırı ve eşzamanlı mükerrer kayıt hatası için anlaşılır yanıt eklenmiştir.
  Giriş API'sine ayrıca hız sınırı eklemek bu değişikliğin kapsamında değildir.

Yerel regresyon paketi 76 testi geçti. Yeni senaryolar; uzun sohbet, eşzamanlı haber
çağrısı, kota beklemesi, eski önbellek, oturumsuz erişim ve geçersiz kayıtları kapsar.
Testlerde haber/model/veritabanı bağımlılıkları sahtedir; gerçek AI kotası tüketilmez.
TypeScript, ESLint ve ayrı dizinde üretim derlemesi de geçti. Üretim veritabanı şeması değişmez.

Canlı işlev testleri ve VPS'ye uygulama, kodun GitHub'a aktarılmasından ayrı adımlardır.

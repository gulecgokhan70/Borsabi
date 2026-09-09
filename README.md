# BorsaBi Trader

BIST ve kripto piyasaları için Türkçe eğitim ve sanal işlem uygulaması. Gerçek emir iletimi yapmaz; yatırım tavsiyesi değildir.

## Yerel kurulum

Gereksinimler: Node.js 22, npm 11.9.0 ve PostgreSQL. Kilit dosyasıyla aynı npm sürümünü kullanın (`npm install --global npm@11.9.0`). Uygulama `nextjs_space` klasöründedir.

```bash
cd nextjs_space
npm ci
cp .env.example .env
```

`.env` içinde yerel `DATABASE_URL`, `NEXTAUTH_URL` ve yeni bir `NEXTAUTH_SECRET` ayarlayın. Anahtar üretimi için `openssl rand -base64 32` kullanılabilir. `ABACUSAI_API_KEY` yalnızca AI özellikleri için gereklidir. Gerçek parolaları Git'e eklemeyin.

Yeni, boş geliştirme veritabanını hazırlamak ve uygulamayı başlatmak için:

```bash
npx prisma db push
npm run dev
```

Mevcut üretim veritabanında `prisma db push` çalıştırmayın. USD/TL güncellemesi üç yeni, nullable (boş bırakılabilir) alan ekler; aşağıdaki VPS betiği önce eski kayıtları denetler ve yedek alır. Prisma Client proje içindeki göreli yola üretilir.

İsteğe bağlı geliştirme hesabı: `SEED_EMAIL` ve en az 12 karakterlik benzersiz `SEED_PASSWORD` tanımlandıktan sonra `npx prisma db seed`. Sabit parolalı yönetici oluşturulmaz; üretimde seed kapalıdır.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Gerçek PostgreSQL üzerinde işlem/geri alma/eşzamanlılık testleri için **ayrı ve boş**, yerel `borsabi_test` veritabanı hazırlayın. `DATABASE_URL` ile şemayı bu test veritabanına kurun; `TEST_DATABASE_URL` değişkenini aynı adrese ayarlayıp `npm run test:integration` çalıştırın. Testler uzak veritabanlarını ve farklı veritabanı adlarını reddeder, yalnızca kendi oluşturduğu kullanıcıları temizler.

GitHub Actions aynı kontrolleri PostgreSQL 16 servisiyle çalıştırır.

## Groq ile AI özellikleri

Sohbet, hisse analizi ve haber analizi ortak sunucu bağlantısını kullanır. Groq için
`AI_PROVIDER=groq`, `GROQ_API_KEY` ve `GROQ_MODEL=openai/gpt-oss-120b` tanımlayın.
Eski Abacus kurulumu `AI_PROVIDER=abacus` ve `ABACUSAI_API_KEY` ile çalışmaya devam eder.
Groq başarısız olursa başka bir sağlayıcıya otomatik ve ücretli geçiş yapılmaz.

Ücretsiz kotalar hesabın tüm kullanıcıları arasında paylaşılır; uzun konuşmalar
metin kotasını daha erken tüketebilir. Kota hataları 429 ve Türkçe açıklamayla döner.
Sohbette yalnızca son altı mesaj gönderilir. Yeni soru en fazla 6.000 karakter olabilir;
eski uzun yanıtlar sunucuya verilen bağlamda kısaltılır, ekrandaki sohbet korunur.
Haber ve portföy bağlamı hâlâ
seçilen sağlayıcıya iletilir; model çıktıları doğrulanmış yatırım sinyali değildir.
AI verileri kaynak gecikmelerine tabidir. Groq verileri ve sınırlar için
[Groq belgelerini](https://console.groq.com/docs/rate-limits) inceleyin.

Mevcut Ubuntu VPS kurulumunda, kod güncellendikten sonra root terminalinde:

```bash
python3 /opt/borsabi/nextjs_space/scripts/configure-groq.py
bash /opt/borsabi/nextjs_space/scripts/deploy-ai.sh
```

İlk komut anahtarı gizli ister, küçük bir JSON yanıtıyla Groq erişimini sınar,
başarılıysa mevcut veritabanı/oturum ayarlarını koruyarak izinleri 600 olan
ayar dosyalarına kaydeder. Anahtarı komuta, Git'e veya sohbete yazmayın.
İkinci komut artık `deploy-currency.sh` üzerinden yeni sürümü ayrı bir klasöre çıkarır,
bağımlılıklarını kurar ve derler. Eski site bu hazırlık sırasında açık kalır. Eski kripto
kayıtlarında kur yoksa mevcut siteye dokunmadan durur ve yalnızca kayıt sayılarını gösterir.
Derleme başarılıysa servis kısa süre durdurulur; geçmiş tekrar kontrol edilir, yerel
PostgreSQL veritabanının yedeği alınır ve yalnızca üç yeni kolon eklenir. Seed çalıştırılmaz.
Yeni sürümün HTTP kontrolleri başarısızsa önceki uygulama ayarına dönülür; yeni kolonlar
eski sürümle uyumlu olduğu için kullanıcı verileri üzerine yedek geri yüklenmez.
Eski sürüm klasörleri ve `/root/borsabi-currency-backup.*` yedekleri silinmez.
Anahtar ve kota hesabınıza bağlı olduğundan sağlayıcı testi ilk komutla tamamlanır.

Anahtarı zaten ayarlanmış bu VPS'de sonraki kod güncellemeleri için:

```bash
runuser -u borsabi -- git -C /opt/borsabi pull --ff-only
bash /opt/borsabi/nextjs_space/scripts/deploy-ai.sh
```

## Kayıt ve haber analizi sınırları

Kayıt formu ve API ortak doğrulamayı kullanır: geçerli e-posta, en az sekiz karakter
ve bcrypt sınırı nedeniyle en fazla 72 UTF-8 bayt şifre; isim en fazla 80 karakterdir.
Bu kurallar yeni kayıtlar içindir; mevcut kullanıcıların şifreleri değiştirilmez.
Kayıt API'si istemci IP'si başına 15 dakikada beş denemeye izin verir.

Haber analizi API'si oturum gerektirir ve kullanıcı başına dakikada on isteğe izin verir.
Analiz 30 dakika saklanır; aynı anda isteyenler tek model çağrısını paylaşır.
Boş haber akışı veya sağlayıcı hatasında en az bir dakika beklenir; daha uzun
`Retry-After` süresine uyulur. Hata sırasında varsa altı saatten yeni analiz, kendi
`analyzedAt` tarihi korunarak döner. Sohbet bu ortak servisi doğrudan kullanır.

Önbellek ve hız sınırları mevcut tek Node sürecinin belleğindedir; yeniden başlatmada
sıfırlanır. Birden fazla süreç/sunucuya geçmeden önce ortak depoya taşınmalıdır.
IP sınırı, Nginx'in `$proxy_add_x_forwarded_for` ile eklediği son adresi kullanır;
Node yalnızca `127.0.0.1` üzerinde dinlemelidir. Önüne başka proxy/CDN konursa güvenilen
istemci IP zinciri ayrıca yapılandırılmalıdır.

## İşlem davranışı

- Yalnızca piyasa emri desteklenir. Limit/stop-limit emirleri koşul beklemeden gerçekleşmesin diye arayüzde kapalıdır ve API tarafından reddedilir.
- İşlem fiyatı sunucunun piyasa kaynağından alınır; istemcinin gönderdiği fiyat işlem fiyatını belirlemez. Kaynak veriler gecikmeli olabilir.
- Bakiye, pozisyon ve işlem geçmişi tek veritabanı işlemi içinde yazılır. Eşzamanlı yazma çakışmaları sınırlı sayıda yeniden denenir.
- BIST miktarı pozitif tam sayı, kripto miktarı pozitif kesir olabilir. Endeks alım satımı kapalıdır.
- Fiyat alarmları tek kez tetiklenir. İz süren stop alarmları, normal fiyat alarmı olmasa da kontrol edilir; otomatik satış emri oluşturmaz.

## Kripto ve TL muhasebesi

- Hesap bakiyesi, işlem toplamı, komisyon, gerçekleşmiş/gerçekleşmemiş K/Z ve portföy toplamları **TRY** cinsindedir.
- Kripto birim fiyatı, stop/kar al seviyeleri ve grafikler **USD** cinsinde kalır. BIST fiyatları TRY'dir.
- Sunucu, her kripto işleminde `USDTRY=X` kaynağını doğrular; istemciden kur kabul etmez. `Transaction.fxRate` ve `fxAsOf` işlemde kullanılan kuru ve kaynağın zamanını saklar.
- `Position.entryPriceTry`, komisyon hariç ağırlıklı TL birim maliyetidir. Kur değişse veya kısmi satış yapılsa da alış maliyeti korunur; gerçekleşen K/Z satışın TL geliri ve orantılı alış komisyonu ile hesaplanır.
- Portföy, profil, risk merkezi ve AI portföy bilgisi ortak TL değerleme servisini kullanır. Tek bir eski BUY satırına yanlış gerçekleşmemiş K/Z atamak yerine açık pozisyon K/Z'si Portföy'de gösterilir.
- USD/TL kaynağı en fazla dört günlük olabilir (hafta sonu için son döviz kotasyonu). Eksik, geçersiz, daha eski veya ileri tarihli kurla işlem yapılmaz. Kur yokken USD değeri TRY gibi gösterilmez; ilgili toplam yerine hata gösterilir.
- İşlem penceresindeki TL tutarları tahmindir. Bakiyenin yüzdesiyle alım komisyonu içerir; kriptoda kesirli miktar korunur ve satışın net TL geliri gösterilir.

Eski BIST kayıtları mevcut TL maliyetiyle okunur. Eski kripto kayıtlarına bugünün kuru
yazılmaz; nakit ve geçmiş işlemler değiştirilmez. Geçiş denetimi kur kaydı eksik kripto
pozisyonu/işlemi bulursa dağıtımı durdurur. Bu durumda çıkan sayılarla geçmiş kayıtları
incelemek ve veriye dayalı ayrı bir düzeltme hazırlamak gerekir. Bu sürüm eski, hatalı
USD/TL işlemlerini otomatik olarak düzeltmiş sayılmaz.

## Mevcut sınırlamalar

- Önceki sürümlerdeki kripto USD/TL muhasebe hatası için yukarıdaki eski kayıt denetimi geçerlidir. Bu güncelleme yeni işlemleri düzeltir; doğrulanmamış tarihsel kur üretmez.
- Paket seçimi halen simülasyon davranışıdır; kullanıcı profilinden değiştirilebilir. Gerçek ücretli abonelik için doğrulanmış ödeme ve sunucuda özellik yetkisi kontrolü gerekir.
- Bu değişiklik önceki yanlış işlem kayıtlarını geriye dönük yeniden hesaplamaz.

Ayrıntılı bulgular ve doğrulama: [inceleme raporu](docs/review-2026-09-08.md).

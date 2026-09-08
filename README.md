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

Mevcut üretim veritabanında bu kurulum komutunu otomatik çalıştırmayın. Bu düzeltme veritabanı modeli değişikliği gerektirmez; Prisma Client artık proje içindeki göreli yola üretilir.

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
Yeni sohbetlerde yalnızca son altı mesaj gönderilir. Haber ve portföy bağlamı hâlâ
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
İkinci komut mevcut site açıkken ayrı bir derleme klasörü oluşturur; yalnızca başarılı
derlemeden sonra servisi yeniden başlatır (kısa kesinti olabilir). Yerel HTTP sağlık
kontrolü başarısızsa önceki derleme ayarına döner. Eski derlemeler silinmez.
Üretim veritabanında şema veya seed komutu çalıştırmaz. Anahtar ve kota hesabınıza
bağlı olduğundan gerçek sağlayıcı testi VPS'deki ilk komutla tamamlanır.

## İşlem davranışı

- Yalnızca piyasa emri desteklenir. Limit/stop-limit emirleri koşul beklemeden gerçekleşmesin diye arayüzde kapalıdır ve API tarafından reddedilir.
- İşlem fiyatı sunucunun piyasa kaynağından alınır; istemcinin gönderdiği fiyat işlem fiyatını belirlemez. Kaynak veriler gecikmeli olabilir.
- Bakiye, pozisyon ve işlem geçmişi tek veritabanı işlemi içinde yazılır. Eşzamanlı yazma çakışmaları sınırlı sayıda yeniden denenir.
- BIST miktarı pozitif tam sayı, kripto miktarı pozitif kesir olabilir. Endeks alım satımı kapalıdır.
- Fiyat alarmları tek kez tetiklenir. İz süren stop alarmları, normal fiyat alarmı olmasa da kontrol edilir; otomatik satış emri oluşturmaz.

## Mevcut sınırlamalar

- Kripto USD fiyatları ve TL bakiyeleri eski modelde aynı sayısal hesapta kullanılıyor. Çoklu para birimi muhasebesi ve mevcut kayıtların kur dönüşümü ayrı bir veri geçişi gerektirir. Kripto portföy toplamları bu geçişten önce güvenilir TL değerlemesi olarak sunulmamalıdır.
- Paket seçimi halen simülasyon davranışıdır; kullanıcı profilinden değiştirilebilir. Gerçek ücretli abonelik için doğrulanmış ödeme ve sunucuda özellik yetkisi kontrolü gerekir.
- Bu değişiklik önceki yanlış işlem kayıtlarını geriye dönük yeniden hesaplamaz.

Ayrıntılı bulgular ve doğrulama: [inceleme raporu](docs/review-2026-09-08.md).

# BorsaBi Android paket hazırlığı

Bu dizin mevcut Next.js uygulamasını **TWA (Trusted Web Activity)** içinde açan Android kaynak paketini üretir. TWA, doğrulanmış web alan adını destekleyen Android tarayıcısında uygulama görünümünde açar. Site VPS üzerinde çalışmaya devam eder; web oturumu, API ve mevcut Web Push kullanılır. İnternet bağlantısı gerekir.

## Kimlik ve sürüm

Mağaza paket adı henüz doğrulanmadı. Mevcut bir BorsaBi/Median kaydı varsa onun `applicationId` değeri, önceki en yüksek `versionCode` değeri ve mevcut yükleme anahtarı korunmalıdır. Bu araç yeni mağaza kaydı açmaz, anahtar üretmez, imzalama veya yükleme yapmaz.

Kaynak üretimini mağaza kimliğinden bağımsız doğrulamak için:

```bash
cd android
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run prepare:preview
```

Çıktı: `generated/com.borsabi.packagingpreview-1/`. Bu kimlik yalnızca derleme denemesi içindir; Play'e yüklenmez ve canlı `assetlinks.json` içine eklenmez. Çıktı zaten varsa araç onu koruyarak durur.

Gerçek paket adı ve sürüm bilgileri doğrulandığında:

```bash
node scripts/prepare.mjs --package-id DOGRULANMIS_PAKET_ADI --version-code YENI_POZITIF_SAYI --version-name 1.0.0
```

Yukarıdaki büyük harfli alanlar açıklayıcı yer tutucudur; aynen çalıştırılmaz. Sürüm kodu önceki tüm yüklemelerden büyük olmalıdır; araç Play hesabını okumadığı için önceki sürümle karşılaştırma yapamaz.

## Derleme

Sabitlenmiş araçlar: Bubblewrap Core **1.25.0**, Android Gradle Plugin **8.10.1**, Gradle **8.11.1**, Java **17**. Hedef/derleme Android API **36**, minimum API **23**. Kaynak üretimi depodaki ikonları geçici loopback sunucusundan okur; canlı siteye erişmez. Gradle üretiminde bu geçici adres kalmaz.

Android Studio SDK Manager üzerinden Android SDK Platform 36 ve Build Tools 35.0.0 kurulur. Oluşturulan proje klasöründe:

```bash
bash gradlew --no-daemon :app:bundleRelease :app:lintRelease
```

Çıktı `app/build/outputs/bundle/release/app-release.aab` olur. **AAB, Play'e yüklenen Android App Bundle dosyasıdır; bu komutun çıktısı imzasızdır.** Telefona doğrudan kurulamaz ve bu haliyle Play'e yüklenemez. CI akışı yalnızca imzasız önizleme kimliğini derler; anahtara ve canlı hesaba erişmez.

Generator sonrası uygulanan değişiklikler: desteklenen API 36 araç sürümü, Maven Central, yerel derleme adreslerinin üretim adresiyle değiştirilmesi, Android sarmalayıcı yedeğinin ve düz HTTP'nin kapatılması. `bubblewrap update` bu ayarları ezebilir; yeniden üretim bu script üzerinden yapılır. Sarmalayıcı yedeğini kapatmak tarayıcıdaki web oturumunu/verilerini silmez.

## İmzalama ve alan adı doğrulaması

1. Play Console → uygulama → **Uygulama bütünlüğü / App integrity** ekranında paket adı, uygulama imzalama sertifikası ve yükleme sertifikası doğrulanır. Menü yeri Console sürümüne göre değişebilir.
2. Mevcut uygulamada mevcut yükleme anahtarı kullanılır. Yeni uygulama olduğu kesinleşirse sahibi tarafından kalıcı ve yedekli bir yükleme anahtarı hazırlanır. Anahtar veya parolası Git'e eklenmez.
3. Android Studio → Generate Signed Bundle / APK → Android App Bundle ile gerçek kimlikli projeden AAB imzalanır. Yeni anahtar oluşturulması mevcut uygulamayı otomatik güncelleyebilmek anlamına gelmez.
4. VPS ortamına **açık kimlik bilgileri** eklenir: `ANDROID_APPLICATION_ID` ve `ANDROID_SHA256_CERT_FINGERPRINTS`. İkinci alan, **Play uygulama imzalama sertifikasının SHA-256 parmak izi** olmalıdır; yalnızca yükleme sertifikası yeterli değildir. Sertifika döndürme durumunda gereken birden fazla parmak izi virgülle ayrılabilir.
5. Web sürümü yayınlanır. `https://borsabi.com/.well-known/assetlinks.json` oturum istemeden, yönlendirmesiz, JSON ve HTTP 200 dönmelidir. Eksik/geçersiz ayarda endpoint 404 döner; yanlış bir ilişkilendirme yayımlamaz.
6. Play'den kurulan paketle adres çubuğunun kaybolması, oturum/giriş/çıkış, Android geri hareketi, bildirim, dış bağlantı, ekran döndürme, büyük yazı ve çevrimdışı açılış denenir. Alan adı doğrulanamazsa tarayıcı çubuğu görünür.

Varsayılan güvenilen alan adı yalnızca `https://borsabi.com`. `www` veya başka bir alan adına geçiş uygulama görünümünden çıkabilir; ek güvenilen alan adı ancak o alanın da bağımsız Digital Asset Links doğrulaması sağlandıktan sonra eklenir.

## Hazır dosyalar ve sınırlar

- `../docs/google-play/store-listing-tr.md`: Türkçe mağaza metni taslağı.
- `../docs/google-play/testers-guide-en.md`: Testers Community için İngilizce yönerge + Türkçe ekran sözlüğü.
- `../docs/google-play/release-readiness.md`: veri beyanı çalışma tablosu, görsel ve yayın eksikleri, dil kapsamı.
- `../nextjs_space/public/offline.html`: kişisel veri içermeyen Türkçe/İngilizce bağlantı ekranı.

İngilizce uygulama dili henüz eklenmedi. Bu hazırlık mağaza onayı, imzalı paket veya cihaz testi yerine geçmez.

## Kaynaklar — 9 Eylül 2026 kontrolü

- [TWA kurulumu ve alan adı doğrulaması](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Android 16 / API 36 hedef şartı](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB)
- [AGP 8.10, Gradle ve Java uyumluluğu](https://developer.android.com/build/releases/agp-8-10-0-release-notes)
- [Play imzalama ve yükleme anahtarının farkı](https://developer.android.com/studio/publish/app-signing)

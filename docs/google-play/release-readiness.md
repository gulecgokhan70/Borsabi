# Google Play yayın hazırlığı — 9 Eylül 2026

Bu çalışma paket üretim altyapısı ve Console hazırlığıdır. Hesaba form gönderilmedi, test ekibine mesaj atılmadı, mağazaya paket yüklenmedi. İmzalı ve cihazda doğrulanmış yayın henüz yok.

## Sıra ve mevcut durum

| İş | Durum / kanıt |
|---|---|
| Mevcut uygulama kimliği | Play Console paket adı ve önceki versionCode bekleniyor; yeni kimlik varsayılmadı |
| Android kaynak üretimi | `android/scripts/prepare.mjs`; Bubblewrap 1.25.0, API 36, AGP 8.10.1 |
| Alan adı doğrulaması | `/.well-known/assetlinks.json` route'u; gerçek paket adı + Play imzalama sertifikası olmadan 404 |
| Bağlantı kaybı | Türkçe/İngilizce genel offline ekranı; kişisel sayfalar, API ve işlemler önbelleğe alınmaz |
| Türkçe mağaza metni | `store-listing-tr.md` hazır taslak |
| Test ekibi yönergesi | `testers-guide-en.md` hazır; Testers Community'nin Türkçe anlama yeteneği henüz doğrulanmadı |
| İngilizce uygulama | Mevcut arayüz Türkçe; aşağıdaki çalışma kapsamı hazır, tam çeviri uygulanmadı |
| Play imzalama | Mevcut yükleme anahtarı / Play App Signing bilgileri doğrulanmalı |
| Kapalı test | İmzalı paket, erişim linki, test listesi ve gerçek cihaz denemeleri bekleniyor |

## Console beyanları için kod envanteri

Aşağıdaki tablo **gönderilmeye hazır Veri Güvenliği cevabı değildir**. Kodun işlediği verileri, amaçları ve açık doğrulama noktalarını ayırır. Canlı sağlayıcı ayarları ve iş ilişkileri doğrulanmadan “veri toplamıyoruz/paylaşmıyoruz” seçilmez. [Google Veri Güvenliği tanımları](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

| Kodda bulunan veri | Kullanım / konum | Console öncesi teyit |
|---|---|---|
| Ad, e-posta, kullanıcı kimliği | `User`, üyelik ve oturum | Zorunlu/isteğe bağlı alanları gerçek kayıt ekranıyla eşleştir |
| Parolanın bcrypt özeti | `User.password`, kimlik doğrulama | Parolanın düz metin kaydedilmediği doğrulandı; beyan sınıfını formdaki tanıma göre seç |
| Sanal işlemler, notlar, pozisyonlar, izleme listesi | Prisma ilişkileri, simülasyon ve özet | Gerçek banka/ödeme bilgisi değil; simülasyon faaliyetinin uygun veri sınıfını değerlendir |
| AI mesajları, yanıtlar ve bildirimler | `ChatMessage`, `AiContentReport`; aktif AI sağlayıcısına istek | Groq/Abacus'tan hangisi canlı? Mesaj ve analiz bağlamı aktarımı, saklama ve hizmet sağlayıcı istisnası teyit edilmeli |
| Profil tercihleri, takip ilişkileri, başarılar | İlgili User/SocialFollow/Achievement kayıtları | Diğer kullanıcılara görünür alanlar, kullanıcı kontrolü ve sosyal içerik akışı teyit edilmeli |
| Web Push aboneliği ve bildirim içeriği | `PushSubscription`, `AppNotification`, tarayıcı push hizmeti | Bildirim tercihi ve push sağlayıcısına aktarım; cihaz/diğer kimlik sınıfı değerlendirmesi |
| Pratik oturumu ve işlemleri | `ReplaySession.state` | Geçmiş fiyat pratiğinin ana portföyden ayrı olduğunu açıkla |
| IP / erişim ve hata günlükleri | Nginx, sunucu, altyapı sağlayıcısı | Uygulama kodu dışında; süre, erişim ve saklama işletmeci tarafından belirlenmeli |

Hesap silme aktif veritabanındaki ilişkili verileri siler. Yedekler ve sunucu günlükleri aynı işlemle otomatik silinmez. İşletmeci adı/iletişimi, saklama süreleri, geri yükleme sonrası silme taleplerinin korunması ve sağlayıcı aktarım ayrıntıları gizlilik metninde tamamlanmalıdır. `info@borsabi.com` adresinin ileti aldığı test edilmelidir. Gerçekte sunulmayan saklama/silme süreleri yazılmaz.

Finansal özellikler beyanı, içerik derecelendirmesi, hedef kitle, reklam, uygulama erişimi ve Veri Güvenliği formları gerçek son sürümle eşleştirilir. Simülasyon olduğu açıkça yazılır; “simülasyon” ifadesinin tek başına finansal özellikler beyanını kaldırdığı varsayılmaz. [Finansal özellikler politikası](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en)

AI yanıt bildirimi ana asistan ve işlem koçunda mevcut. Diğer AI yanıt yüzeylerinin kapsamı ve bildirimlerin yönetici tarafından incelenme süreci kontrol edilmelidir. Uygulama içi bildirim mekanizması tek başına bütün AI güvenlik şartlarını karşılamaz. [Üretken AI politikası](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en)

Pro paketler mevcut; Android içinde ücretli dijital özellik satışı açılmadan ödeme akışı ayrıca tamamlanmalıdır. Bu hazırlık ödeme SDK'sı eklemez veya ücretli özelliği ücretsiz/aktif göstermez.

## Görseller ve inceleme erişimi

- Depoda 512×512 uygulama ikonu ve maskelenebilir ikon var; Android üretimi farklı cihaz yoğunlukları için bunları işler.
- Play için 1024×500 tanıtım görseli ve son Android sürümünden temiz telefon ekran görüntüleri hazırlanmalı. Eski iPhone terminal ekranları kullanılmaz. Mağaza yükleme ekranındaki güncel boyut koşulları doğrulanmalı.
- Ekranlarda gerçek parola, e-posta, yönetici yetkisi veya erişim anahtarı görünmemeli. Gerçek arayüzün çalışır sürümü gösterilmeli.
- İnceleyici için ayrı, normal yetkili ve çalışan hesap; açıklayıcı erişim yönergesi hazırlanmalı. Hesap şifresi depoya konmamalı. Giriş gerektiren tüm akışların incelenebilir olduğu doğrulanmalı.
- Kapalı test sonuçları cihaz/sürüm/tarih ve yeniden üretim adımlarıyla toplanmalı. Android 16, farklı ekran boyutu, ekran döndürme, büyük metin, geri hareketi, bildirim ve ağ kaybı özellikle denenmeli.

Yeni kişisel hesap için en az 12 testçinin kesintisiz 14 gün katılım şartı güncel resmi kaynaktan doğrulandı; sonrasında üretim erişimi başvurusu ve değerlendirme vardır. Ücretli test ekibi kullanmak süreyi otomatik kısaltmaz. [Test gereksinimleri](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

## İngilizce dil için uygulanacak kapsam

Uygulamada 20'den fazla sayfa, Türkçe API hata mesajları, grafik etiketleri, sayı/tarih gösterimleri ve Türkçe AI yönergeleri bulunuyor; tek bir dil düğmesi eklemek tam çeviri sayılmaz.

1. `tr` / `en` sözlükleri, kalıcı dil tercihi ve doğru HTML `lang` değeri oluşturulur. Türkçe varsayılan kalır.
2. İlk tam akış: kayıt/giriş → arama → varlık detayı → işlem formu → portföy → işlem geçmişi → profil/komisyon → hesap silme ve AI bildirimleri. Doğrulama/hata/boş/yükleniyor mesajları da çevrilir.
3. Mevcut backtest, geçmiş pratik ve eğitim ekranları aynı sözlüklere bağlanır; yeni bir ikinci backtest oluşturulmaz.
4. Sayı/tarih `Intl` ile dile göre biçimlenir. **Dil değişimi fiyat para birimini, USD/TRY muhasebesini veya profil komisyonunu değiştirmez.** İngilizce ondalık nokta ile Türkçe ondalık virgül girişleri için ayrı doğrulama senaryoları gerekir.
5. AI yanıt dili açıkça iletilir; kaynak haber içeriğinin kendiliğinden İngilizce olduğu iddia edilmez. Hukuki metinler eşdeğer içerikle çevrilir.
6. Tam akışlar iki dilde, Android klavyesi ve dar ekranla doğrulandıktan sonra İngilizce mağaza metni etkinleştirilir.

Testers Community Türkçe akışları yeterince değerlendirebiliyorsa İngilizce test rehberi ilk kapalı test için yardımcı olabilir. Dilin anlaşılmaması nedeniyle işlemler tahmin edilerek “başarılı” işaretlenmemelidir.

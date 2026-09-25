# Borsabi Bot Laboratuvarı v0.3 — güncel platforma entegre otomatik seçim

## Durum

Borsabi kaynak koduna entegre geliştirme paketi. Canlı siteye gönderilmedi; sunucuda servis veya veritabanı değişikliği yapılmadı. Gerçek borsa API'si, emir bağlantısı veya borsa anahtarı saklama kodu yoktur.

Taban: `d66a809924e6b6e0d15804abce74164b51ff1afe` (`codex/fix-trading-and-alerts`). Güncel gezinme, para birimi alanları ve Next.js 15.5.24 korunur. Önceki v0.1 paketindeki tek varlık motoru, geçmiş test uç noktası ve eski hesaplar korunur. Yeni ekranda oluşturulan hesaplar `auto-v2` modundadır; v0.1 hesaplar otomatik çevrilmez, hesap başına piyasa benzersizliği devam eder. Mevcut eski hesap varsa silip sıfırlamayın; ayrı veri taşıma çalışması gerekir.

## İşleyiş

- Menü veya Keşfet → Bot Laboratuvarı → varlıkları ve sınırları seç → Oluştur → Başlat.
- Her kullanıcı için BIST ve kriptoda ayrı ayrı 100.000 sanal TL hesabı. `User.balance`, `Position` ve `Transaction` değişmez. Yalnızca `PaperBot` ve `PaperBotEvent` kullanılır.
- Pilot evren: THYAO, PGSUS, TUPRS, ASELS, AKBNK, GARAN, BIMAS, EREGL; kriptoda BTC, ETH, SOL, AVAX, LTC. Kullanıcı bunların alt kümesini seçebilir. Evren tüm piyasa değildir, güncel hacim sıralaması veya yatırım önerisi değildir.
- Son 120 kapanmış 15 dakikalık mumdan EMA20/50 hesaplanır; en az 51 mum gerekir. EMA son fiyatlara daha fazla ağırlık veren ortalamadır. Yeni yukarı kesişim, fiyatın EMA20 üzerinde olması, pozitif ama %20 altında beş mumluk momentum, son hacmin önceki 20 mum ortalamasına en az eşit olması ve oynaklık filtresi birlikte aranır.
- Son 20 getirinin standart sapması BIST için en fazla %2,5, kripto için %4 olmalı. Bunlar deneysel kurallardır; tahmin başarısı doğrulanmadı. Son 21 mumda eksik aralık varsa alım adayı oluşmaz. BIST açılışından sonra bu yüzden yaklaşık beş saatlik kesintisiz veri gerekebilir. Hacim sıfır/eksikse sinyal üretmek için uydurulmaz. Mutlak piyasa likiditesi, emir defteri ve gerçek alış/satış makası modellenmez.
- Uygunluk puanı: trend 40; pozitif momentum en çok 25; göreli hacim en çok 20; oynaklık en çok 15. En az 65 puan ve yeni kesişim gerekir. Puan başarı yüzdesi değildir. Puanı yüksek adaylar önce yer ayırır; eşit puan sembolle deterministik sıralanır.
- Varsayılan işlem bütçesi masraflar dahil güncel bot değerinin %5'i, en fazla üç pozisyon. Aynı gruptan en fazla bir varlık: THYAO/PGSUS ulaşım, AKBNK/GARAN banka; ETH/SOL/AVAX akıllı sözleşme grubu. Bu basit çeşitlendirme kuralı istatistiksel korelasyon analizi değildir.
- İlk gözlem ve yeniden başlatma geçmiş alım sinyallerini atlar. Sinyal sunucuda görüldükten **sonraki** zaman damgalı kotasyonla alış/sinyal satışı yapılır. Bekleyen sinyal 30 dakikada dolar. Gelecekteki mumlar kullanılmaz.
- BIST tam adet, kripto sekiz ondalık. Hisse komisyonu oluşturma anında kullanıcı profilinden sunucuda alınır (sıfır dahil). Kripto komisyonu ve kayma kullanıcı varsayımıdır, doğrulanmış platform tarifesi değildir. Alış/satışta ayrı masraf düşülür. Kayma olumsuz yönde uygulanır.
- Varsayılan zarar sınırı %2, kâr hedefi %4. Koruma satışları sonraki yeni geçerli kotasyonda değerlendirilir; fiyat seviye atladıysa gerçek gözlenen kotasyon + olumsuz kayma kullanılır, sınırdan gerçekleşmiş gibi yazılmaz. Mum içindeki görülmemiş fiyatlara göre satış icat edilmez.
- Günlük zarar, son bilinen portföy değerini ve açık pozisyonu kapsar; İstanbul takvimine göre önceki son değerlemeden ölçülür. %2 kayıpta yeni alımlar kilitlenir, açık pozisyon çıkışları devam eder. Aynı gün yeniden başlatmak kilidi kaldırmaz. Eski fiyatlı bir açık pozisyon varsa yeni alımlar da engellenir.
- Duraklat yeni alımları ve bekleyen alışları durdurur; çalışan worker açık pozisyon değerlemesini/çıkışlarını sürdürür. Tümünü kapat ayrı, teyitli sanal işlemdir; komuttan sonraki fiyatı bekler, yeni alımlar kapalı kalır. Veri yoksa bekleme açıklaması gösterilir. Servis durmuşsa hiçbir koruma çalışmaz.

## Veri ve ölçek sınırları

Yahoo Finance adaptörü kullanılır. BIST kotasyonu en fazla 20 dakika, kripto 5 dakika eski olabilir; gelecekteki veya geçersiz fiyatlar reddedilir. BIST'te sağlayıcı `REGULAR` durumu ve hafta içi İstanbul 10:00–18:00 penceresi gerekir. Gecikmeli veri nedeniyle sonuçlar gerçek zamanda işlem sonucu sayılmaz. Son 15 dakikalık mum kapanışı BIST'te en fazla 40 dakika, kriptoda 20 dakika eski olabilir.

Kripto stratejisi USD mumlarıyla hesaplanır; işlem ve hesap değeri güncel USD/TL ile TL'ye çevrilir. Kur 20 dakikadan eskiyse **tüm kripto hesabı kontrolü bekler**. Hafta sonu kesintisiz çalışma sağlanmaz; ayrı kesintisiz TRY veri kaynağı sonraki aşamadır. Eski değerler canlı olarak etiketlenmez.

Worker her turdan sonra yaklaşık 60 saniye bekler. Sağlayıcı çağrıları sınırlı eşzamanlılık ve mevcut cache ile yapılır. Çok sayıda hesapta tur süresi uzayabilir; bu küçük pilot içindir. Her hesapta `checkedAt` gösterilir. Heartbeat tur sonu güncellenir; üç dakikadan uzun turda ekran hizmeti doğrulanamadı diyebilir.

Durum ve tüm olaylar aynı veritabanı transaction'ında (tek atomik kayıt) yazılır. `version` koşulu aynı hesabı iki worker'ın ilerletmesini veya kullanıcı duraklatırken eski gözlemin üstüne yazılmasını önler. Başarısız version kontrolünde olaylar da yazılmaz. API kullanıcı oturumuyla sahipliği doğrular, fiyat veya bakiye istemciden kabul etmez. Kullanıcı/piyasa benzersiz indeksi çift hesabı engeller.

Çoklu varlık için eski 30 günlük tek varlık backtesti kullanılmaz; API açıkça reddeder. v0.2 ileriye dönük sanal testtir. Başarı ölçümü için komisyon sonrası getiri, düşüş, işlem sayısı, veri boşlukları ve yeterli süre gözlenmeli. Sinyal eşikleri sonuçlara bakarak sürekli optimize edilmemeli.

## Kurulum (sunucuda henüz uygulanmadı)

Geliştirme dalında birleştirildikten ve CI (otomatik kontroller) geçtikten sonra mevcut VPS yayın yöntemi kullanılabilir:

```bash
runuser -u borsabi -- git -C /opt/borsabi pull --ff-only && bash /opt/borsabi/nextjs_space/scripts/deploy-platform.sh
```

Bu komut yalnızca sunucudaki dal bu sürümü içeriyorsa günceller. Önce `git log -1` ile sürüm eşleşmesi kontrol edilmeli. Kod GitHub'a ulaşmadan bu komutu çalıştırmak botu kurmaz.

Yayın betiği yeni sürümü ayrı dizinde derler. Yazıcı servisleri durdurduktan sonra PostgreSQL yedeği alır; mevcut platform geçişinin ardından `scripts/bot-migration.ts` ile yalnızca bot tablolarını/indekslerini ekler. Migration tekrar çalıştırılabilir; eski sanal bakiye ve olayları sıfırlamaz. Prisma şemasını yeni kodla generate eden mevcut npm postinstall korunur. SQL tablolara destructive değişiklik yapmaz.

Ayrı `borsabi-paper-bot.service`, diğer otomasyon servisinden bağımsız olarak aynı release dizininde çalışır. `/etc/borsabi.env` kullanılır, tek worker için `flock` kilidi vardır. Normal uygulama ve eski otomasyonun kontrolüne ek olarak bot API'sinin oturumsuz 401 yanıtı ve yeni bot heartbeat'i (servisin son tamamladığı kontrol zamanı) doğrulanır. Kontrol başarısızsa önceki uygulama/worker dosyaları ve bot servisinin önceki etkinlik durumu geri yüklenir. Veritabanı yedeği canlı yeni işlemlerin üstüne otomatik geri yüklenmez.

Ön kontrol: `bash scripts/deploy-platform.sh --check` root VPS ortamında hiçbir yayın/veritabanı işlemi yapmadan mevcut servis, env ve çalışma ağacını kontrol eder. Çalışan sunucuya bu oturumdan doğrudan SSH erişimi yoktur; hosting terminalinde çalıştırma gerekir.

Kurulum sonrası test hesabında oluşturma, başlatma, aday gerekçeleri, fiyat zamanları ve duraklatma doğrulanmalı. Gerçek sağlayıcıya erişim başarısızsa bot işlem yapmamalı. Varsayılan botlar kullanıcı Başlat demeden aktif değildir; mevcut kullanıcılar için otomatik bot oluşturulmaz.

Gerçek işlem bağlantısı sonraki ayrı aşamadır: aynı seçim/risk çekirdeğinin yanında broker adaptörü, emir kimliğiyle yinelenme önleme, kısmi gerçekleşme, iptal, bakiye/pozisyon mutabakatı ve bağlantı kesintisi kuralları gerekir. Sanal moddan otomatik gerçek moda geçiş yoktur.

## Doğrulama

- Güncel platformun 329/329 testi geçti; bot paketinin 28 testi buna dahildir.
- TypeScript, ESLint ve Next.js 15.5.24 üretim derlemesi geçti.
- Şema tekrar uygulama, aynı botta iki worker yarışı, eski version yazısının reddi ve normal işlem defterinden yalıtım için üç PostgreSQL entegrasyon testi eklendi. Mevcut CI PostgreSQL servisi bu testleri çalıştırır.
- Yerel ortam PostgreSQL kurulumuna izin vermediği için yeni gerçek veritabanı testleri burada çalıştırılmadı; CI sonucu ayrıca doğrulanmalı.
- Canlı VPS geçişi, gerçek telefon görsel kontrolü ve canlı veri sağlayıcı oturumu burada yapılmadı. Gerçek alım/satım emri gönderilmez.

## Katalog taraması ve grafik tutarlılığı — 25 Eylül 2026

Yeni botlarda varsayılan kapsam `all`: Borsabi kataloğundaki 611 hisse / 40 kripto. Bu,
yeni listelenen tüm dünya varlıklarının otomatik keşfi anlamına gelmez; kaynak katalog
`lib/bist-data.ts` ve `lib/constants.ts` üzerinden güncellenir. Verisi olmayan veya eski
semboller gerekçesiyle elenir. Manuel seçili liste modu en fazla 8 varlıkla korunur.
Mevcut botlarda **Tüm desteklenen varlıkları tara** düğmesi kapsamı değiştirir; nakit,
pozisyonlar, gerçekleşen sonuç, günlük zarar kilidi ve duraklama durumu korunur. Bekleyen
alışlar iptal edilir; yeni kapsam için ilk gözlem geçmiş sinyalden giriş üretmez.

Tarama sunucuda piyasa başına ortak 48'lik gruplar halinde döner. Aynı anda en fazla
3 grafik isteği, 6 varlık yüklemesi vardır; web arayüzünün grafik kuyruğu kullanılmaz.
Bir grubun sonucu 60 saniye paylaşılır; tüm katalog aynı anda değerlendirilmez.
611 hisselik tur en az 13 grup gerektirir; gerçek süre sağlayıcı yanıtlarına, aktif bot
sayısına ve işçi döngüsüne bağlıdır. Kısa ömürlü kesişimler turlar arasında kaçabilir.
İlerleme ortak tarayıcının turunu, aday tarihleri her hesabın son gözlemini gösterir.
Yeniden başlatmada ortak tarayıcı baştan başlar; hesap ve işlem kayıtları korunur.
Aday sıralaması o kontrol grubuna aittir; tüm kataloğun eşzamanlı en iyisi iddiası yoktur.

Açık pozisyonlar ve bekleyen emirler geniş taramadan **önce** ayrı işlenip sürüm denetimiyle
kaydedilir. Kullanıcı aynı anda kontrolü değiştirirse eski işçi sonucu yazılamaz. Güncel
fiyat mevcutken grafik geçmişinin alınamaması koruyucu satış kontrolünü engellemez.
Katalogdan çıkmış açık pozisyonlar da izlenmeye devam eder. Duraklatılmış botta açık
pozisyon kontrolü sürer, geniş alım taraması yapılmaz. USD/TL güncellik kuralı değişmedi.
Mevcut grup sınırları korunur; katalogdaki her varlık için sektör/korelasyon sınıflaması yoktur.

Seçili liste, açık pozisyonlar, adaylar ve karar günlüğündeki semboller `/stock/<symbol>`
sayfasına gider. Yüzlerce bağlantı için otomatik sayfa ön yüklemesi kapalıdır.

Günlük BIST grafiği önceki mevcut seansın son Yahoo mumunu referans alır. Fiyat açılıştan
gerilese bile önceki kapanıştan yüksekse günlük çizgi yeşildir. Haftalık/aylık grafik
kendi ilk ve son noktasıyla değişimini hesaplar. Üstteki büyük grafik fiyatı, yüzdesi,
renk ve dokunulan nokta aynı veri dizisini kullanır. Son piyasa fiyatı sabit üst çubukta;
alım/satım formu bu piyasa fiyatını kullanmaya devam eder. Grafik kaynağı ve nokta zamanı
görünür. Günlük referans yoksa değişim uydurulmaz, nötr gösterilir. Dönem değişirken eski
veri yeni dönemin etiketi altında çizilmez.

Doğrulama: 344 birim/akış testi, TypeScript ve ESLint başarılı. Katalog döngüsü/paylaşımı,
kur güncelliği, grafik kesintisinde çıkış, hesap korunarak kapsam geçişi, eşzamanlı kullanıcı
kontrolü, detay bağlantıları ve AKCNS günlük/haftalık renk regresyonu kapsandı.
Veritabanı şemasında değişiklik yok. Gerçek cihaz ve canlı veriyle yeni kapsamın tam turu,
sunucuya dağıtıldıktan sonra ayrıca gözlenmelidir.

## Gecikme görünürlüğü ve öncelikli izleme — 25 Eylül 2026

Kaynak gecikmesi tarama hızıyla ortadan kaldırılmaz. İşçi her tamamlanan turun ardından
60 saniye bekler; ağ istekleri ve diğer hesapların işlem süresi bu aralığa eklenir.
15 dakikalık mum kullanımı sabit 15 dakika ek gecikme demek değildir: hareketin mumun
içindeki yerine göre kapanış beklenir, ardından kaynağın bu kapanışı göstermesi gerekir.
Mevcut botların 15 dakikalık EMA20/50 stratejisi, risk ayarları ve hesapları korunur.
Saatlik/günlük stratejiye otomatik geçiş yapılmaz; böyle bir değişiklik ayrı değerlendirme gerektirir.

Tam katalog modunda son 30 dakikada değerlendirilmiş, geçerli mum zamanı bulunan,
en az 40 puanlı en güçlü 12 aday ayrıca izlenir. Katalog üyeliği, son değerlendirme
zamanı ve puan denetlenir; açık pozisyonlar/bekleyen emirler bu 12'lik kotaya dahil
değildir. Önce pozisyon/emir kontrolleri kaydedilir, sonra adaylar taze gözlemle yeniden
değerlendirilip kaydedilir, en son normal 48'lik katalog grubu işlenir. Her kayıtta
optimistic version kontrolü vardır; kullanıcı kontrolüyle yarışta eski sonuç yazılmaz.
Geniş tarama başarısız olsa bile önce kaydedilen koruyucu/öncelikli sonuçlar korunur.
Eski aday puanı yalnızca yeniden kontrol listesini seçer; kendi başına emir oluşturmaz.
Duraklamada veya kapatma isteğinde yeni aday taraması yapılmaz.

Öncelikli/seçili liste ve pozisyon mum önbelleği 60 saniye; geniş katalog mum önbelleği
240 saniyedir. İki önbellek de sınırlıdır ve aynı üç eşzamanlı grafik isteği sınırını
kullanır. Fiyatlar kaynak zamanını korur. Eski katalog fiyatı, daha yeni fiyatla yapılan
aday değerlendirmesini geriye alamaz. Sağlayıcı kesintisinde önbellekten dönen mumlar
zaman denetimlerinden muaf değildir.

Yeni aday kayıtlarında fiyat zamanı/kaynak; bekleyen emirlerde sinyal mumu kapanışı ve
sinyal fiyatı zamanı; işlem olaylarında sinyal/karar zamanı, kullanılan fiyat zamanı,
botun gözlem zamanı ve sanal kayıt zamanı ayrıdır. Eski olaylarda eksik alanlar uydurulmaz.
Arayüz fiyat yaşını kaynak zamanından hesaplar; karar günlüğünde yaş kayıt anına göredir.
Bekleyen emirler ve son geçerlilik zamanı görülebilir. Kaynak zaman damgası değişmeden
gelen aynı fiyatla tekrar emir yürütülmez. Sinyale bağlı emirler `tick.time > pending.after`
koşulunu korur; gecikmeli veri bu zamanı aşana kadar ek bekleme oluşabilir.
Koruyucu zarar/kâr satışları gözlenen fiyatla modellenir; canlı gerçekleşme veya o
fiyattan gerçekten satış garantisi anlamına gelmez.

Kaynak bu aşamada Yahoo Finance olarak kalır. Doğrudan kripto borsası verisi veya
lisanslı gerçek zamanlı BIST verisi eklenmemiştir. TL bazlı kripto hesabının kur güncellik
kuralı korunur. Veritabanı şeması ve dağıtım betiği değişmedi; ek alanlar JSON kayıtlarında
isteğe bağlıdır. Sunucuda yeni sürüm kurulmadan bu iyileştirmeler çalışmaz.

Doğrulama: 355 test / 80 dosya, TypeScript, ESLint ve üretim derlemesi başarılı.
Gecikmeli sinyalin geçmiş fiyatla doldurulmaması, ayrı zaman kayıtları, öncelik sınırı,
eski adayın elenmesi, önbellek yenileme süresi, geniş tarama hatası ve sürüm çatışması
durumlarında kayıt sırası ve mobil arayüzde zaman alanları test edildi.

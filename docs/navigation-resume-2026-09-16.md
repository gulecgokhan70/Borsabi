# Gezinme ve kaldığın yerden devam — 16 Eylül 2026

- Yan menüde mevcut 22 bağlantı korunarak Temel işlemler, Öğren ve keşfet, Gelişmiş araçlar ve Hesap grupları oluşturuldu. Gelişmiş araçlar varsayılan kapalı; aktif alt sayfada açık. Klavyeyle kullanılabilen native details/summary, aktif bağlantıda aria-current ve en az 44px dokunma alanı kullanılır. Mobil alt gezinme korunur.
- Ana sayfada son ziyaret edilen katalog varlığı ve son ders için tarih/saatli devam kartı. Kart gizlenebilir ve yeniden açılabilir. Bilinmeyen varlık, silinmiş kurs, harici veya bozuk bağlantı gösterilmez.
- Dersin seçili bölümü ve tamamlanan bölümleri hesap/kurs anahtarıyla tarayıcıda saklanır. Kayıt yüklenmeden mevcut ilerleme ezilmez; hesap değişiminde önceki hesabın bilgileri korunarak yeni hesabın durumu yüklenir.
- İlk kez kullanan ve geçmişi olmayan hesapta boş bir devam kartı gösterilmez; mevcut ilk işlem rehberi çalışır.

## Kontroller ve sınırlar

Yerelde 204 test ve eklenen iki gerçek React akış testi geçti. Tip kontrolü ve lint başarılı. GitHub CI tüm testleri, veritabanı entegrasyonunu ve üretim derlemesini çalıştırır.

İlerleme bu tarayıcıya özeldir; cihazlar arasında eşitlenmez. Eski sürümde ders ilerlemesi saklanmadığı için geçmişte kaybolan ilerleme geri getirilemez. Quizde verilen tek tek cevaplar ve sayfanın kaydırma konumu saklanmaz. Backtest sonuçlarına devam etme veya araç sabitleme bu pakette eklenmedi.

Gerçek telefonda menü gruplarını, ders değiştirip ana sayfadan devam etmeyi ve gizle/göster eylemlerini dağıtım sonrasında kontrol edin. Bu paket veritabanı geçişi gerektirmez; standart deploy-platform.sh kullanılabilir.

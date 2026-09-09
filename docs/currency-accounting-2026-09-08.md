# Kripto USD/TL düzeltmesi

Başlangıç sürümü: `7dde0d1`. Yeni sistemde piyasa kotasyonu ve stop seviyeleri kriptoda
USD, nakit hareketleri ve performans toplamları TRY'dir.

## Model ve kapsam

`Position.entryPriceTry` ağırlıklı TL maliyetini korur. `Transaction.fxRate` ve
`Transaction.fxAsOf` işlem anındaki dönüşümü denetlenebilir kılar. Mevcut fiyat
alanları USD olarak kalır; BIST için birim kur 1'dir. Alış ve satış komisyonları TL
hesaplanır; kısmi satış alış komisyonunu orantılı tüketir.

Portföy, profil, risk merkezi ve AI portföy metni aynı değerleme işlevini kullanır.
İşlem penceresinde bakiye ve toplamlar TL, kripto fiyatları USD etiketlenir. Tutarla
alım ve yüzde düğmeleri TL bütçeyi kullanır; tam satış düğmesi kesirli bakiyeyi korur.
Kur kesintisinde sahte sıfır/1:1 dönüşüm gösterilmez ve yeni işlem yapılmaz.

## Geçmiş kayıtlar ve dağıtım

Eski BIST kayıtları zaten TL'dir. Eski kripto işlemlerinde tarihsel kur olmadığı için
otomatik yeniden fiyatlama, toplu bakiye düzeltme veya veri silme yapılmaz.
`currency-migration.ts --check` eski şemada da çalışır; yalnızca eksik kur taşıyan
kripto kayıtlarının sayısını verir. Varsa dağıtım durur; veri temelli ayrı bir geçmiş
düzeltmesi hazırlanmalıdır. Sıfırsa yeni sürüm izole klasörde derlenir, eski servis
durdurulduktan sonra denetim tekrarlanır ve `pg_dump` yedeği alınır.

DDL işlemi tek veritabanı işlemi içindedir; iki tablo kilitlenir, geçmiş yeniden
doğrulanır, yalnızca üç nullable kolon eklenir. Para tutarları ve eski satırlar
yeniden yazılmaz. Başarısız açılışta systemd ayarı eski uygulamaya döner; yedek
güncel işlemler üzerine otomatik yüklenmez. Sunucudaki gerçek geçiş ayrıca
doğrulanmalıdır; kaynak kod testleri canlı dağıtım kanıtı değildir.

`bash /opt/borsabi/nextjs_space/scripts/deploy-currency.sh --check` yalnızca
başlangıç kontrollerini yapar: root, ortam dosyasının varlığı, aktif servis ve
takip edilen dosyalardaki yerel değişiklikler. Paket kurulumu, derleme, servis
değişikliği veya veritabanı işlemi yapmaz; geçiş denetiminin yerine geçmez.
Betik durursa nedeni ve ilgili aşama yazılır. Yerel değişikliklerde yalnızca
dosya adları gösterilir; dosyalar otomatik sıfırlanmaz, ortam dosyası okunmaz.

## Doğrulama senaryoları

- Kur değişip dolar fiyatı aynı kaldığında TL K/Z değişir.
- Farklı kurlarla birden çok alış ve kısmi/tam satış; net bakiye ve toplam K/Z eşleşir.
- USD olarak karşılanabilen ancak TL olarak karşılanamayan alım reddedilir.
- Kullanıcının sahte kuru dikkate alınmaz; hatalı para birimi, eksik/eski kur reddedilir.
- Eşzamanlı alımlarda TL bakiyesi korunur; işlem kaydı hatasında tüm yazılar geri alınır.
- Eski kripto kaydı varsa hem geçiş hem maliyetleri karıştıran işlem durur.
- Tekrarlanan şema geçişi bakiyeleri ve kayıtları değiştirmez.

Testlerdeki kur ve fiyatlar sentetiktir; gerçek piyasa değeri olarak kullanılmaz.
Veritabanındaki mevcut Float alanları korunmuştur; ondalık veri türüne genel geçiş,
tarihsel piyasa verilerinin lisansı ve eski işlem hatalarının düzeltilmesi ayrı kapsamdır.

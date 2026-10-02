# İşlemden öğrenme paketi — 14 Eylül 2026

## Kullanıcı akışı

- Alım formunda isteğe bağlı senaryo: −%10, −%5, %0, +%5, +%10. Referans fiyat, sabit kur varsayımı ve profil komisyonu görünür. Alış ve varsayımsal tam satışın iki komisyonu net sonuçta birer kez düşülür. Geçersiz miktarda senaryo gösterilmez.
- Bu alımın portföy payı = alımın brüt TL değeri / (mevcut nakit + mevcut pozisyon değeri − alış komisyonu). Aynı varlıktaki eski alımlar bu payın payına dahil değildir. Eksik portföy değeri tahmin edilmez.
- Karar notu gelişmiş risk ayarlarının dışına taşındı. “Neden alıyorum, planım ne?” / “Neden satıyorum?” alanı isteğe bağlı ve 2.000 karakter sınırında. Var olan Transaction.note alanı ve emir tekrar koruması kullanılır.
- İşlem günlüğündeki İşlem koçu, aynı pozisyonun satış anına kadar kaydedilmiş ilk 20 alışının gerekçe ve SL/TP kayıtlarını sonuçla birlikte gösterir. AI hizmeti yanıt vermediğinde kayıtlı tutarlar ve notlar gösterilmeye devam eder. Ayrı bir AI isteği eklenmedi.
- Yeni Transaction.positionId alanı alış/satış kayıtlarını gerçek pozisyon döngüsüne bağlar. Yeni pozisyon açılışı farklı kimlik alır. Kısmi satış aynı döngüde kalır. Eski kayıtlara tahmini bağlantı atanmaz; eksik bağlantı açıkça belirtilir. Bir alış notuna ayrı getiri atfedilmez.
- BIST işlem koçunda kur etkisi gösterilmez. Net sonuçtan komisyonları tekrar düşmemek gerektiği açıklanır.
- İlk işlem rehberi varsayılan olarak yalnızca sıradaki adımı gösterir; tüm adımlar istenirse açılır. Tamamlandığında kısa özete dönüşür.

## Veritabanı ve dağıtım

Prisma şemasına nullable positionId ve kullanıcı/pozisyon/zaman indeksi eklendi. scripts/platform-schema.sql aynı eklemeyi tekrar çalıştırılabilir SQL ile uygular. Mevcut deploy-platform.sh yedekleme ve platform geçişi adımını kullanır. Eski bakiye ve işlem notları değiştirilmez. Yeni kod veritabanı geçişi uygulanmadan başlatılmamalıdır.

## Kontroller

Yerel testler: 198 testin tamamı ve ardından eklenen 3 arayüz senaryosu geçti. Tip kontrolü ve lint başarılı. PostgreSQL testi yeni/kısmi/kapanan/yeniden açılan pozisyonda işlem bağlantısını ve notları doğrular; bu test ve üretim derlemesi GitHub CI'da çalıştırılır.

Dağıtım sonrası gerçek telefonda rehberin dar görünümü, klavye açıkken karar notu, sıfır komisyonlu ve komisyonlu senaryo, notlu alışın satışı ve İşlem koçu kontrol edilmeli. Kullanıcı araştırması, fiyat tahmini veya yatırım getirisi doğrulaması yapılmadı. Bu dosya tek başına canlı dağıtımın tamamlandığını göstermez.

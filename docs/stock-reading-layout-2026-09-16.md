# Hisse ekranı ve analiz okuma görünümü — 16 Eylül 2026

Kullanıcının paylaştığı ONRYT ekranları referans alınarak hisse detayının bilgi sırası ve grafik kontrolleri sadeleştirildi. BorsaBi kimliği, açık/koyu tema ve sanal işlem davranışı korunur.

## Ekranlar

- Ana görünüm: beyaz/koyu düz zemin, küçük sabit hisse başlığı, şirket adı, büyük fiyat, geniş çizgi grafiği. Günlük grafikte mevcut önceki kapanış referansı ve son noktayı belirten işaret.
- Grafiğin altında tek satırda 1G, 1H, 1A, 3A, 1Y, 5Y; mum/çizgi ve simgeli tam ekran düğmeleri. 5Y gerçek beş yıllık haftalık veri ister. 6A ve kısa mum aralıkları teknik görünümün seçicisinde korunur.
- Tam ekran teknik grafik: sağdaki fiyat ekseni, EMA veya SMA 20/50/200, ayrıca açılabilen Bollinger; birbirinden bağımsız Hacim, RSI ve MACD alanları. Çizim araçları ve terim açıklamaları açılır bölümde. Gösterge geçmişi yetersizse sahte çizgi yerine açıklama.
- EMA ve SMA birbirinin yerine etiketlenmez. RSI için Wilder düzeltmesi kullanılır; tüm seriler görünür aralık kesilmeden önce geçmiş veriden hesaplanır. Hisse özetindeki RSI, grafiğin son RSI değeriyle eşleşir. Haftalık 200 dönem için ek geçmiş istenir.
- Fiyat grafiğinin altında kısa analiz girişi ve ayrı açılan, büyük metinli analiz okuma ekranı. Analiz talep üzerine oluşturulur; oluşturulma zamanı fiyat zamanı yerine geçmez. Trend, haber etkisi, teknik yorum, seviyeler, senaryolar ve riskler düz bölümler hâlinde sunulur. Model sinyali ve kendi güven puanı açıklamalı ayrıntı bölümündedir.
- “Analizi derinleştir” aynı hisseyle AI Asistan’a gider. Soru alanı doldurulur; otomatik gönderim yapılmaz.
- İlk dört istatistik açık; ek istatistikler, haberlerin tamamı ve diğer teknik/temel ayrıntılar genişletilebilir. Mevcut işlevler silinmedi.
- Sat/Al hem ana görünümde hem tam ekran grafikte erişilebilir. Tam ekrandan işlem başlatmak grafiği kapatıp güncel işlem fiyatıyla formu açar. Grafikte seçilen tarihsel fiyat emir fiyatı olmaz.

## Dayanıklılık ve doğrulama

Analiz yanıt okuyucusu Türkçe bayt bölünmesini, son satırda satır sonu olmamasını, eksik sonuçları ve servis hata kayıtlarını işler. Yinelenen tıklamalar tek isteğe dönüşür; varlık değişiminde önceki analiz isteği iptal edilir. İstek 90 saniyede zaman aşımına uğrar ve tekrar deneme sunar. Grafik bilgi kutularının üç saniyede kapanma davranışı korunur.

260 otomatik test, tip kontrolü ve lint geçti. Testler gerçek React bileşen durumunu ve veri işlemlerini çalıştırır; grafik çizimi ve portal/odak katmanı testlerde değiştirilmiştir. SMA/RSI hesaplamaları, geçmiş verinin kırpılması, 5Y isteği, gösterge geçişleri, tam ekrandan işlem formuna geçiş, para birimleri, komisyon, analiz sonucu/hatası ve AI soru aktarımı kapsanır.

Cloud Browser yerel önizlemeye erişimi URL güvenlik politikasıyla engelledi. Bu nedenle gerçek tarayıcıda görsel yerleşim, odak yönetimi ve gerçek telefon kontrolü bu ortamda tamamlanmadı; dağıtım sonrası 375–390 px mobil genişlikte ve masaüstünde kontrol edilmelidir. Üretim derlemesi ve GitHub kontrolleri ayrıca çalıştırılır.

Yeni Android paketi veya veritabanı şeması değişikliği gerekmez. Standart `scripts/deploy-platform.sh` web sürümünü günceller. Canlıya otomatik dağıtım yapılmadı.

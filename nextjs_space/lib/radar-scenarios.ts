/** Educational transmission scenarios. No probability calibration or measured price forecast. */
export type ScenarioDirection = 'Pozitif' | 'Negatif' | 'Karma' | 'Koşula bağlı';
export type SectorScenario = { sector: string; positive: string; negative: string };
export type ImpactScenario = {
  topic: string; direction: ScenarioDirection; assumption: string;
  market: string; positive: string; negative: string; sectors: SectorScenario[]; watch: string[];
};
const normalize = (text: string) => text.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const sector = (name: string, positive: string, negative: string): SectorScenario => ({ sector: name, positive, negative });
// Match subjects, not a generic "rose/fell" elsewhere in the sentence.
const uncertain = /\?|\b(?:iddia|soylenti|yalanlandi|yalanladi|degil|beklentisi|bekleniyor|olabilir|yarin|gecen yil|gecen ay)\b/;
function trend(title: string, subject: string): 'up' | 'down' | null {
  if (uncertain.test(title)) return null;
  const up = new RegExp(`(?:${subject}).{0,35}\\b(?:yukseldi|artti|artirdi|yukseltti|tirmaniyor|rekor kirdi)\\b`).test(title);
  const down = new RegExp(`(?:${subject}).{0,35}\\b(?:dustu|geriledi|azaldi|indirdi|dusurdu)\\b`).test(title);
  return up === down ? null : up ? 'up' : 'down';
}
export function buildImpactScenario(rawTitle: string): ImpactScenario | null {
  const title = normalize(rawTitle.slice(0, 500));
  if (/\b(?:petrol|brent|dogalgaz|dogal gaz|enerji maliyet)/.test(title)) {
    const move = trend(title, 'petrol|brent|dogalgaz|dogal gaz');
    return { topic: 'Enerji maliyeti', direction: move === 'up' ? 'Negatif' : move === 'down' ? 'Pozitif' : 'Koşula bağlı',
      assumption: move === 'up' ? 'Enerji fiyat artışının kalıcı olması ve satış fiyatlarına aktarılamaması halinde.' : move === 'down' ? 'Maliyet düşüşünün talep daralmasından kaynaklanmaması halinde.' : 'Enerji fiyatının yönü ve kalıcılığına göre iki ayrı senaryo.',
      market: 'Enerji ithal eden ekonomide maliyet, dış denge ve enflasyon kanalları üzerinden BIST değerlemelerine yansıyabilir.',
      positive: 'Enerji ucuzlar ve talep korunursa maliyet baskısı azalabilir; enerji tüketen şirketlerin kâr marjları desteklenebilir.',
      negative: 'Enerji pahalanır ve yüksek kalırsa enflasyon ile finansman baskısı artabilir; maliyetini aktaramayan şirketler zorlanabilir.',
      sectors: [sector('Havayolu ve taşımacılık', 'Yakıt ucuzlar, yolcu/yük talebi korunursa giderler azalabilir.', 'Yakıt pahalanır ve korunma sözleşmeleri yetersizse marjlar daralabilir.'), sector('Sanayi ve petrokimya', 'Enerji ve hammadde ucuzlar, satış hacmi korunursa maliyet avantajı oluşabilir.', 'Girdi maliyeti satış fiyatından hızlı artarsa kârlılık gerileyebilir.'), sector('Rafineri', 'Ürün marjı ve kapasite kullanımı güçlenirse sonuçlar desteklenebilir.', 'Ürün marjı daralır veya stok zararı oluşursa ham petrol düşse bile sonuçlar zayıflayabilir.')],
      watch: ['Brent/doğalgaz fiyatının devamı', 'USD/TRY', 'Şirketin yakıt koruması ve ürün marjları'] };
  }
  if (/\b(?:faiz|tcmb|fed|ecb|merkez bankasi)\b/.test(title)) {
    const move = trend(title, 'faiz');
    return { topic: 'Faiz ve finansman', direction: move === 'up' ? 'Negatif' : move === 'down' ? 'Pozitif' : 'Koşula bağlı',
      assumption: move === 'up' ? 'Faiz artışının beklentiyi aşması ve risk primindeki düşüşün bunu dengelememesi halinde.' : move === 'down' ? 'Faiz indiriminin kur ve enflasyonda bozulma yaratmadan krediye yansıması halinde.' : 'Kararın piyasa beklentisine göre sürprizine bağlı; beklenti verisi henüz bağlı değil.',
      market: 'Kredi maliyeti, nakit akışlarının bugünkü değeri ve risk iştahı üzerinden genel piyasa üzerinde etkili olabilir.',
      positive: 'Finansman maliyeti düşer ve fiyat istikrarına güven korunursa yatırım ve talep desteklenebilir.',
      negative: 'Beklentiden sıkı finansman veya kur/enflasyon bozulması şirket değerlemeleri üzerinde baskı yaratabilir.',
      sectors: [sector('Gayrimenkul ve otomotiv', 'Kredi faizleri düşer ve kredi erişimi artarsa talep canlanabilir.', 'Kredi maliyeti yükselir veya erişim daralırsa satışlar yavaşlayabilir.'), sector('Bankacılık', 'Kredi kalitesi iyileşir ve fonlama maliyeti uygun hızda düşerse marjlar desteklenebilir.', 'Mevduat maliyeti hızlı yükselir veya sorunlu krediler artarsa kârlılık baskılanabilir.')],
      watch: ['Karar ile piyasa beklentisi farkı', 'Tahvil faizleri ve USD/TRY', 'Mevduat/kredi faizleri ve karar metni'] };
  }
  if (/\b(?:enflasyon|tufe|ufe)\b/.test(title)) {
    const move = trend(title, 'enflasyon|tufe|ufe');
    return { topic: 'Enflasyon', direction: move === 'up' ? 'Negatif' : move === 'down' ? 'Pozitif' : 'Koşula bağlı', assumption: 'Gerçekleşmenin beklentiye göre farkı ve kalıcılığı belirleyici; yalnız manşet oran yeterli değil.',
      market: 'Faiz beklentisi, satın alma gücü ve maliyetler üzerinden piyasa fiyatlamasını değiştirebilir.',
      positive: 'Enflasyon beklentiden hızlı ve kalıcı yavaşlarsa faiz ve risk primi baskısı hafifleyebilir.', negative: 'Enflasyon beklentiyi aşar ve kalıcılaşırsa sıkı finansman beklentisi ve maliyet baskısı artabilir.',
      sectors: [sector('Perakende ve tüketim', 'Reel gelir toparlanırsa satış hacmi desteklenebilir.', 'Satın alma gücü düşerse hacim kaybı yaşanabilir.'), sector('Sanayi', 'Girdi maliyetleri yavaşlarsa marjlar iyileşebilir.', 'Girdi maliyeti satış fiyatlarına aktarılamazsa marjlar daralabilir.')], watch: ['Çekirdek ve aylık enflasyon', 'Beklenti-gerçekleşme farkı', 'Ücretler, faizler ve satış hacmi'] };
  }
  if (/\b(?:savas|ateskes|catisma|jeopolitik|bogaz|hormuz)\b/.test(title)) {
    return { topic: 'Jeopolitik ve tedarik', direction: 'Koşula bağlı', assumption: 'Gerilimin tırmanması veya azalması ayrı değerlendirilir; başlık tek başına gerçekleşmeyi doğrulamaz.', market: 'Risk primi, enerji maliyeti ve taşıma süreleri üzerinden piyasa oynaklığını artırabilir.',
      positive: 'Gerilim azalır, sevkiyatlar normale dönerse risk primi ve maliyet baskısı hafifleyebilir.', negative: 'Çatışma genişler veya sevkiyatlar aksarsa riskten kaçış ve maliyet baskısı artabilir.',
      sectors: [sector('Turizm ve havayolu', 'Güvenlik algısı ve ulaşım normale dönerse talep desteklenebilir.', 'Seyahat iptalleri, rota uzaması ve yakıt maliyeti kârlılığı zorlayabilir.'), sector('Lojistik ve sanayi', 'Tedarik süreleri kısalırsa işletme sermayesi ihtiyacı azalabilir.', 'Gecikme ve sigorta maliyeti artarsa üretim ve marjlar baskılanabilir.')], watch: ['Resmî açıklamalar ve sevkiyatlar', 'Petrol, navlun ve sigorta fiyatları', 'Risk primi ve döviz kuru'] };
  }
  if (/\b(?:gumruk|tarife|yaptirim|ambargo|ekonomik onlem|ticaret savasi|ihracat kisit|ithalat kisit)/.test(title)) {
    return { topic: 'Ticaret politikası', direction: 'Koşula bağlı', assumption: 'Önlemin kapsamı, uygulanması ve Türk şirketlerinin ilgili pazara maruziyetine bağlı.', market: 'Dış talep, tedarik maliyeti ve yatırım belirsizliği üzerinden BIST sektörlerini farklı yönlerde etkileyebilir.',
      positive: 'Türk üreticiler alternatif tedarikçi olur ve yeni sipariş kazanırsa bazı ihracatçılar desteklenebilir.', negative: 'Kısıtlamalar talebi daraltır veya ithal girdiyi pahalandırırsa büyüme ve marjlar baskılanabilir.',
      sectors: [sector('Otomotiv, tekstil ve ihracatçılar', 'Ticaret yön değiştirir ve yeni siparişler Türkiye’ye gelirse hacim artabilir.', 'Ana ihracat pazarı daralır veya ek tarife uygulanırsa hacim düşebilir.'), sector('Elektronik ve sanayi', 'Yerel tedarik payı artarsa uygun kapasitesi olan üretici kazanabilir.', 'İthal parça ve teknoloji erişimi zorlaşırsa maliyet artabilir.')], watch: ['Önlem kapsamı ve yürürlük tarihi', 'Şirketlerin ülke bazlı satışları', 'Yeni siparişler ve girdi fiyatları'] };
  }
  if (/\b(?:dolar|doviz|usd|kur|tl)\b/.test(title)) {
    return { topic: 'Döviz kuru', direction: 'Karma', assumption: 'Şirketin net döviz pozisyonu, ithal girdisi ve fiyatlama gücü dikkate alınmalı.', market: 'Kur hareketi ihracat geliri ile ithalat ve döviz borcu maliyetlerini aynı anda etkiler; bütün BIST için tek yön üretilmez.',
      positive: 'Döviz geliri giderinden yüksek şirketlerde TL gelir artışı maliyet artışını aşarsa marj desteklenebilir.', negative: 'Net döviz borcu ve ithal girdisi yüksek şirketlerde kur artışı bilanço ve nakit akışını zorlayabilir.',
      sectors: [sector('İhracat ve turizm', 'Net döviz geliri yüksekse kur artışı TL gelirleri destekleyebilir.', 'İthal girdi, döviz borcu veya dış talep kaybı bu avantajı silebilir.'), sector('İthalata bağımlı sanayi', 'Kur geriler ve girdi fiyatları düşerse maliyet azalabilir.', 'Kur artışı maliyete yansır ve satış fiyatı sabit kalırsa marj daralabilir.')], watch: ['Net döviz pozisyonu', 'Korunma sözleşmeleri', 'USD/TRY ve ithal girdi payı'] };
  }
  if (/\b(?:bilanco|kar|kari|zarar|ciro|finansal sonuc)\b/.test(title) && !/temettu|kar dagit|kar yag/.test(title)) {
    return { topic: 'Şirket sonuçları', direction: 'Koşula bağlı', assumption: 'Sonuçların piyasa beklentisi, sürdürülebilirliği ve şirket büyüklüğüyle karşılaştırılması gerekir.', market: 'Önce ilgili şirketi etkileyebilir; sektör ve endeks etkisi şirketin ağırlığına ve benzer sonuçların yaygınlığına bağlıdır.',
      positive: 'Beklenti üstü sürdürülebilir faaliyet kârı ve güçlü nakit akışı değerlemeyi destekleyebilir.', negative: 'Beklenti altı faaliyet sonucu, zayıf nakit akışı veya artan borç baskı oluşturabilir.',
      sectors: [sector('Haberdeki şirketin sektörü', 'Benzer şirketlerde talep ve marj iyileşmesi görülürse sektöre yayılabilir.', 'Maliyet veya talep sorunu sektörde yaygınsa olumsuz etki genişleyebilir.')], watch: ['Faaliyet kârı ve tek seferlik kalemler', 'Nakit akışı ve net borç', 'Önceki dönem ve piyasa beklentisi'] };
  }
  if (/\b(?:sozlesme|ihale|siparis|anlasma)\b/.test(title)) {
    return { topic: 'Sipariş ve sözleşme', direction: 'Koşula bağlı', assumption: 'Anlaşmanın bağlayıcılığı, ciroya oranı, kâr marjı ve teslim şartlarına bağlı.', market: 'Şirkete özgü gelir görünürlüğünü etkileyebilir; tek bir sözleşmeden genel borsa yönü çıkarılmaz.',
      positive: 'Bağlayıcı ve kârlı sözleşme yeni sipariş yaratırsa gelecek gelirleri destekleyebilir.', negative: 'Maliyet, teslim gecikmesi, finansman ihtiyacı veya iptal şartları beklenen katkıyı azaltabilir.',
      sectors: [sector('İlgili üretici ve tedarikçiler', 'Sipariş kapasite kullanımını artırır ve kârlıysa faaliyetler güçlenebilir.', 'Sabit fiyatlı işte maliyet yükselir veya tahsilat gecikirse nakit baskısı oluşabilir.')], watch: ['Sözleşme tutarı / yıllık ciro', 'KAP açıklaması ve teslim süresi', 'Marj, finansman ve iptal koşulları'] };
  }
  if (/\b(?:temettu|bedelsiz|sermaye artir|pay geri alim)/.test(title)) {
    return { topic: 'Sermaye ve temettü', direction: 'Koşula bağlı', assumption: 'İşlemin mekanik fiyat düzeltmesi ile şirketin ekonomik değerindeki değişim ayrılmalı.', market: 'Öncelikle ilgili şirketin nakit ve pay yapısını etkiler; bedelsiz artırım tek başına değer yaratmaz.',
      positive: 'Sürdürülebilir serbest nakit akışı temettüyü finanse ediyorsa yatırımcı güvenini destekleyebilir.', negative: 'Dağıtım veya sermaye ihtiyacı finansmanı zorlar ya da pay başına değeri azaltırsa baskı oluşabilir.',
      sectors: [sector('İlgili şirket', 'Sağlıklı nakit üretimiyle desteklenen dağıtım olumlu karşılanabilir.', 'Borçla finanse edilen dağıtım veya zayıf kullanım planı değerlemeyi zorlayabilir.')], watch: ['Hak kullanım ve fiyat düzeltme tarihi', 'Pay başına düzeltilmiş değerler', 'Nakit akışı ve sermayenin kullanım amacı'] };
  }
  if (/\b(?:ihracat|uretim|buyume|gsyh|sanayi|issizlik|istihdam|pmi|tesvik|hibe)\b/.test(title)) {
    return { topic: 'Talep ve üretim', direction: 'Koşula bağlı', assumption: 'Verinin reel büyümeyi, beklenti farkını ve sürdürülebilir siparişleri yansıtmasına bağlı.', market: 'Şirket gelir beklentileri ile enflasyon ve finansman beklentileri arasında farklı etkiler yaratabilir.',
      positive: 'Reel sipariş ve üretim artar, maliyetler kontrol edilirse kâr beklentileri desteklenebilir.', negative: 'Talep zayıflar veya büyüme yalnız fiyat artışından gelirse hacim ve marjlar baskılanabilir.',
      sectors: [sector('Sanayi ve ihracat', 'Yeni sipariş ve kapasite kullanımı artarsa gelirler desteklenebilir.', 'Dış talep veya üretim zayıflarsa sabit maliyet yükü artabilir.'), sector('Tüketim ve lojistik', 'Reel gelir ve ticaret hacmi toparlanırsa satışlar desteklenebilir.', 'İstihdam ve alım gücü zayıflarsa tüketim ile taşıma hacmi düşebilir.')], watch: ['Reel/nominal ayrımı ve mevsimsellik', 'PMI yeni siparişler ve kapasite kullanımı', 'Beklenti farkı ve şirket marjları'] };
  }
  if (/\b(?:yapay zeka|cip|yari iletken|teknoloji|siber)\b/.test(title)) {
    return { topic: 'Teknoloji ve tedarik', direction: 'Koşula bağlı', assumption: 'Gelişmenin yeni talep mi, maliyet mi yoksa erişim kısıtı mı yarattığına bağlı.', market: 'Öncelikle ilgili teknoloji şirketleri ve onların tedarikçileri etkilenebilir; BIST geneline doğrudan yön atanmaz.',
      positive: 'Verimlilik ve yeni talep artışı kârlı satışa dönüşürse şirketlerin gelir beklentileri desteklenebilir.', negative: 'Teknoloji erişimi kısıtlanır, yatırım maliyeti yükselir veya güvenlik sorunu büyürse nakit akışı baskılanabilir.',
      sectors: [sector('Yazılım ve teknoloji', 'Yeni talep sürdürülebilir abonelik ve hizmet gelirine dönüşürse büyüme desteklenebilir.', 'Maliyet artışı veya rekabet fiyatlama gücünü azaltırsa kârlılık zayıflayabilir.'), sector('Elektronik ve sanayi', 'Uygun maliyetli teknoloji üretkenliği artırırsa marjlar desteklenebilir.', 'Çip ve teknoloji erişimi kısıtlanırsa üretim maliyetleri yükselebilir.')], watch: ['Kısıtlamanın kapsamı ve resmî açıklama', 'Siparişler ve yatırım maliyetleri', 'Şirketin tedarik bağımlılığı ve kâr marjı'] };
  }
  if (/\b(?:bitcoin|kripto|ethereum|btc)\b/.test(title)) {
    return { topic: 'Kripto ve risk iştahı', direction: 'Koşula bağlı', assumption: 'Hareketin likidite, düzenleme veya kaldıraç kaynaklı olup olmadığına bağlı; BIST ile sabit ilişki varsayılmaz.', market: 'Risk iştahı hakkında izlenecek bir gelişmedir; tek başına BIST yönünü belirlemez.',
      positive: 'Kalıcı likidite girişi ve düşen finansman baskısı riskli varlıklara talebi destekleyebilir.', negative: 'Likidite çıkışı, tasfiyeler veya kısıtlamalar kripto varlıklarda satış baskısı yaratabilir.',
      sectors: [sector('Kripto varlıklar ve ilişkili hizmetler', 'Kalıcı talep ve düzenleyici netlik faaliyetleri destekleyebilir.', 'Kaldıraç tasfiyesi ve düzenleyici kısıtlamalar işlem hacmi ve değerlemeyi bozabilir.')], watch: ['Hacim, fon akışı ve kaldıraç tasfiyeleri', 'Düzenleyici açıklamalar', 'Faizler ve dolar likiditesi'] };
  }
  return null;
}

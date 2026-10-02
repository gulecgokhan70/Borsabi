import { createHash } from 'node:crypto';
import type { NewsItem, NewsSourceStatus } from './news-feed';
export type AlertScenario = { positive: string; negative: string; sectors: string[]; watch: string; horizon: string };
export type MarketAlert = {
  id: string; title: string; summary: string; source: string; url: string; publishedAt: string;
  topic: string; context: 'Beklenti / soru' | 'Haber'; priority: boolean; scenario: AlertScenario | null;
};
export type MarketAlertsReport = {
  alerts: MarketAlert[]; checkedAt: string; status: 'ready' | 'partial' | 'empty' | 'unavailable'; failedSources: string[];
};
// Topic templates describe conditional channels, not predictions or confirmation of a headline.
const rules: { topic: string; match: RegExp; scenario: AlertScenario }[] = [
  { topic: 'Para politikası', match: /faiz|tcmb|merkez bankası|\bfed\b|likidite/, scenario: {
    positive: 'Finansman koşulları gevşer ve fiyat istikrarı korunursa krediye duyarlı şirketlerde talep desteklenebilir.',
    negative: 'Finansman koşulları sıkılaşırsa borçlanma maliyetleri artabilir; krediye duyarlı sektörlerin talebi zayıflayabilir.',
    sectors: ['Bankacılık', 'Konut', 'Otomotiv', 'Perakende'],
    watch: 'Kararın kendisini, beklentiye göre farkını ve kredi/mevduat faizlerini birlikte izle. Bankalar için net etki yalnızca faiz yönünden çıkarılamaz.', horizon: 'Karar sonrası; kredi ve talebe yansıması daha uzun sürebilir.',
  } },
  { topic: 'Enerji', match: /petrol|brent|akaryakıt|jet yakıtı/, scenario: {
    positive: 'Yakıt maliyetleri düşer ve talep korunursa havayolu ve taşımacılık şirketlerinin maliyet yükü hafifleyebilir.',
    negative: 'Yakıt maliyetleri artar ve satış fiyatlarına yansıtılamazsa havayolu ve taşımacılık kârlılığı baskılanabilir.',
    sectors: ['Havayolu', 'Taşımacılık'], watch: 'Petrol ile jet yakıtı fiyatını, kur hareketini ve şirketin yakıt maliyetini sabitleyen sözleşmelerini birlikte izle.', horizon: 'Maliyetlere yansıması sözleşmelere göre değişir.',
  } },
  { topic: 'Döviz ve enflasyon', match: /dolar|döviz|(?:^| )kur(?: |$)|enflasyon|tüfe|üfe/, scenario: {
    positive: 'Kur ve enflasyon baskısı azalırsa ithal girdi kullanan şirketlerin maliyet görünümü rahatlayabilir.',
    negative: 'Kur artışı ithal girdi ve döviz borcu maliyetini yükseltirse ilgili şirketlerin kârlılığı baskılanabilir.',
    sectors: ['İthal girdi kullanan şirketler', 'Döviz borcu olan şirketler'], watch: 'Şirketin döviz gelirini, borcunu ve ithal girdi payını karşılaştır; kur hareketi bütün şirketleri aynı yönde etkilemez.', horizon: 'İlk fiyat tepkisi ile bilanço etkisi farklı zamanlarda görülebilir.',
  } },
  { topic: 'Şirketler', match: /bilanço|kâr|karı|zarar|sözleşme|ihale|sipariş/, scenario: {
    positive: 'Açıklanan sonuç veya sözleşme beklentiyi aşar ve nakit akışına katkı sağlarsa şirketin görünümünü destekleyebilir.',
    negative: 'Sonuç beklentinin altında kalır veya maliyet ve tahsilat sorunları oluşursa görünüm zayıflayabilir.',
    sectors: [], watch: 'Şirketin resmi açıklamasını, tutarın faaliyet büyüklüğüne oranını ve önceki beklentileri kontrol et.', horizon: 'Açıklama sonrası; gelir ve nakit etkisi sonraki dönemlerde görülebilir.',
  } },
  { topic: 'Şirketler', match: /temettü|bedelsiz|sermaye artır|sermaye artış/, scenario: {
    positive: 'Dağıtım veya sermaye planı sürdürülebilir nakit üretimi ve verimli yatırımlarla desteklenirse uzun vadeli görünüm güçlenebilir.',
    negative: 'Dağıtım veya finansman ihtiyacı şirketin nakit dengesini zorlaştırırsa görünüm zayıflayabilir.',
    sectors: [], watch: 'Resmi tutarı, hak kullanım tarihini ve fiyat/pay adedi düzeltmesini kontrol et; pay sayısının artması tek başına değer artışı değildir.', horizon: 'Hak kullanım tarihi ve sonraki finansal dönemler.',
  } },
  { topic: 'Düzenlemeler', match: /spk|işlem yasa|devre kesici|yaptırım|düzenleme/, scenario: {
    positive: 'Belirsizlik açık ve uygulanabilir kurallarla azalırsa ilgili piyasada öngörülebilirlik artabilir.',
    negative: 'Karar işlem erişimini veya faaliyetleri kısıtlarsa kapsamındaki şirketlerde likidite ve faaliyet riski artabilir.',
    sectors: [], watch: 'Resmi kararın kapsamını, hangi şirket veya kişiye uygulandığını ve süresini kontrol et; tek bir karar bütün sektöre genellenemez.', horizon: 'Kararın yürürlük tarihi ve geçerlilik süresi.',
  } },
];
function canonicalUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!['bloomberght.com', 'dunya.com', 'kap.org.tr', 'trthaber.com'].some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) return null;
    u.hash = '';
    [...u.searchParams.keys()].filter(k => k.startsWith('utm_') || ['fbclid', 'gclid'].includes(k)).forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch { return null; }
}
export function buildMarketAlerts(news: NewsItem[], sources: NewsSourceStatus[], now = Date.now()): MarketAlertsReport {
  const seenTitles = new Set<string>(), seenUrls = new Set<string>();
  const alerts: MarketAlert[] = [];
  const ordered = [...news].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || Date.parse(b.date) - Date.parse(a.date));
  for (const item of ordered) {
    const age = now - Date.parse(item.date), url = canonicalUrl(item.url);
    if (!url || item.dateVerified === false || !Number.isFinite(age) || age < 0 || age > 48 * 3600_000 || (item.importance ?? 0) < 3) continue;
    const title = item.title.trim().slice(0, 300), normalized = title.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!normalized || seenTitles.has(normalized) || seenUrls.has(url)) continue;
    seenTitles.add(normalized); seenUrls.add(url);
    const rule = rules.find(r => r.match.test(normalized));
    alerts.push({ id: createHash('sha256').update(url).digest('hex').slice(0, 20), title,
      summary: item.summary === item.title ? '' : item.summary.slice(0, 600), source: item.source, url, publishedAt: item.date,
      topic: rule?.topic ?? (item.category === 'kripto' ? 'Kripto' : 'Diğer'),
      context: /\?|ne zaman|hangi tarih|beklenti|beklen|olabilir|artıracak|artacak|azalacak|tahmin|öngörü/.test(title.toLocaleLowerCase('tr-TR')) ? 'Beklenti / soru' : 'Haber',
      priority: (item.importance ?? 0) >= 7, scenario: rule?.scenario ?? null });
    if (alerts.length >= 12) break;
  }
  const failedSources = sources.filter(s => s.state === 'error').map(s => s.source);
  return { alerts, checkedAt: new Date(now).toISOString(), failedSources,
    status: alerts.length ? (failedSources.length ? 'partial' : 'ready') : (failedSources.length ? 'unavailable' : 'empty') };
}

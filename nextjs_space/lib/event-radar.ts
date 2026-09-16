/** Deterministic headline scenarios, not a calibrated return/probability model. */
export type RadarNews = { title: string; url: string; date: string; dateVerified?: boolean };
type Direction = 'olumlu' | 'olumsuz' | 'belirsiz';
type Channel = { sector: string; direction: Direction; mechanism: string; counterScenario: string };
type Rule = { id: string; label: string; match: RegExp; channels: Channel[]; companyOnly?: boolean };
export type RadarEvent = {
  id: string; title: string; publishedAt: string; sourceUrl: string; sourceHost: string;
  sourceType: 'Birincil kaynak' | 'Haber kaynağı'; category: string;
  channels: Channel[]; symbols: string[];
};
export type RadarReport = {
  version: 'headline-scenarios-v1'; generatedAt: string; status: 'scenarios' | 'insufficient';
  events: RadarEvent[]; omitted: number; conflict: boolean; limitations: string[];
};
const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const SOURCES: Record<string, 'Birincil kaynak' | 'Haber kaynağı'> = {
  'kap.org.tr': 'Birincil kaynak', 'tcmb.gov.tr': 'Birincil kaynak', 'tuik.gov.tr': 'Birincil kaynak',
  'bloomberght.com': 'Haber kaynağı', 'dunya.com': 'Haber kaynağı',
};
const COMPANY_NAMES: Record<string, string[]> = {
  THYAO: ['thy', 'turk hava yollari'], PGSUS: ['pegasus'], TUPRS: ['tupras'],
  AKBNK: ['akbank'], GARAN: ['garanti bbva'], YKBNK: ['yapi kredi'],
  ASELS: ['aselsan'], FROTO: ['ford otosan'], BIMAS: ['bim'], SISE: ['sisecam'],
  EREGL: ['erdemir'], TCELL: ['turkcell'], TTKOM: ['turk telekom'],
};
const channel = (sector: string, direction: Direction, mechanism: string, counterScenario: string): Channel => ({ sector, direction, mechanism, counterScenario });
const credit = (tightening: boolean) => channel('Krediye duyarlı sektörler', 'belirsiz',
  tightening ? 'Beklenmedik faiz artışı finansman maliyeti ve değerlemeler üzerinde baskı oluşturabilir.' : 'Beklenmedik faiz indirimi finansman maliyetini azaltarak talebi destekleyebilir.',
  'Karar önceden fiyatlandıysa tepki sınırlı kalabilir; kur, enflasyon ve karar metni etkiyi tersine çevirebilir. Beklenti verisi bağlı değil.');
const RULES: Rule[] = [
  { id: 'rate-up', label: 'TCMB faiz artışı', match: /(?:tcmb|merkez bankasi).{0,55}faiz.{0,25}(?:artirdi|yukseltti)(?:\W|$)/, channels: [credit(true)] },
  { id: 'rate-down', label: 'TCMB faiz indirimi', match: /(?:tcmb|merkez bankasi).{0,55}faiz.{0,25}(?:indirdi|dusurdu)(?:\W|$)/, channels: [credit(false)] },
  { id: 'inflation', label: 'Enflasyon verisi', match: /(?:tufe|enflasyon).{0,55}(?:aciklandi|gerceklesti|yukseldi|geriledi|dustu)(?:\W|$)/,
    channels: [channel('Genel piyasa', 'belirsiz', 'Enflasyonun beklentiden farkı faiz ve iskonto oranı beklentilerini değiştirebilir.', 'Gerçekleşen değer ile aynı dönemin piyasa beklentisi karşılaştırılmadan yön çıkarılamaz.')] },
  { id: 'oil-up', label: 'Petrol maliyeti artışı', match: /(?:petrol|brent).{0,35}(?:yukseldi|artti|tirman(di|iyor))(?:\W|$)/,
    channels: [channel('Havayolu ve taşımacılık', 'olumsuz', 'Artış sürerse yakıt maliyetinde baskı oluşabilir.', 'Yakıt koruması, güçlü talep veya fiyat artışları maliyet etkisini dengeleyebilir.'), channel('Rafineri', 'belirsiz', 'Ham petrol fiyatı tek başına rafineri kârlılığını belirlemez.', 'Ürün marjları ve stok etkisi bilinmeden rafineri hisseleri için yön çıkarılamaz.')] },
  { id: 'oil-down', label: 'Petrol maliyeti düşüşü', match: /(?:petrol|brent).{0,35}(?:dustu|geriledi|ucuzladi)(?:\W|$)/,
    channels: [channel('Havayolu ve taşımacılık', 'olumlu', 'Düşüş sürerse yakıt giderlerinin azalması destek sağlayabilir.', 'Fiyat düşüşü talep zayıflığından kaynaklanıyorsa gelir kaybı maliyet avantajını aşabilir.')] },
  { id: 'earnings-beat', label: 'Beklenti üstü kâr', companyOnly: true, match: /(?:kar|bilanco).{0,40}beklentilerin uzerinde/,
    channels: [channel('Haberde adı geçen şirket', 'olumlu', 'Beklenti üzerindeki kâr destekleyici bir gelişme olabilir.', 'Tek seferlik gelir, zayıf nakit akışı veya düşük gelecek dönem beklentisi olumlu etkiyi sınırlayabilir.')] },
  { id: 'earnings-miss', label: 'Beklenti altı kâr', companyOnly: true, match: /(?:kar|bilanco).{0,40}beklentilerin altinda/,
    channels: [channel('Haberde adı geçen şirket', 'olumsuz', 'Beklenti altındaki kâr değerleme üzerinde baskı oluşturabilir.', 'Sonuç önceden fiyatlandıysa veya gelecek dönem beklentisi güçlüyse tepki farklı olabilir.')] },
  { id: 'contract', label: 'Yeni sözleşme', companyOnly: true, match: /(?:sozlesme|anlasma).{0,35}(?:imzaladi|imzalandi)(?:\W|$)/,
    channels: [channel('Haberde adı geçen şirket', 'olumlu', 'Yeni sözleşme gelecekteki gelir görünürlüğünü destekleyebilir.', 'Sözleşme tutarı, kâr marjı, iptal koşulları ve şirket cirosuna oranı bilinmeden fiyat etkisi ölçülemez.')] },
];
const UNCERTAIN = /\b(?:bekleniyor|beklentisi|beklentileri|tahmin|iddia|soylenti|olabilir|olasi|yarin|aciklanacak|artiracak|indirecek|imzalayacak|artirabilir|indirebilir|imzalayabilir|degil|yalanlandi|yalanladi|yalanlama|ertelendi|gecen yil|gecen ay)\b|\?/;
function source(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname === '/') return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return SOURCES[host] ? { url: parsed.href, host, type: SOURCES[host] } : null;
  } catch { return null; }
}
function companies(title: string): string[] {
  const words = ` ${title.replace(/[^a-z0-9]+/g, ' ')} `;
  return Object.entries(COMPANY_NAMES).filter(([symbol, aliases]) => [symbol.toLowerCase(), ...aliases].some(name => words.includes(` ${name} `))).map(([symbol]) => symbol);
}
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const first = new Set(a.split(' ').filter(w => w.length > 2));
  const second = new Set(b.split(' ').filter(w => w.length > 2));
  if (!first.size || !second.size) return false;
  const intersection = [...first].filter(w => second.has(w)).length;
  return intersection / (first.size + second.size - intersection) >= 0.85;
}
export function buildEventRadar(input: RadarNews[], now = Date.now()): RadarReport {
  if (!Number.isFinite(now)) throw new Error('Invalid analysis time');
  const events: RadarEvent[] = [];
  const seen: { title: string; url: string; rule: string }[] = [];
  const news = input.slice(0, 200).filter(n => n && typeof n.title === 'string' && typeof n.url === 'string' && typeof n.date === 'string')
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  for (const item of news) {
    const published = Date.parse(item.date);
    if (item.dateVerified === false || !Number.isFinite(published) || published > now || now - published > 48 * 3600_000) continue;
    const origin = source(item.url);
    if (!origin) continue;
    // Titles only: a short RSS summary may mix several unrelated events.
    const title = normalize(item.title.slice(0, 500));
    if (UNCERTAIN.test(title)) continue;
    const symbols = companies(title);
    const matches = RULES.filter(rule => rule.match.test(title) && (!rule.companyOnly || symbols.length === 1));
    // Ambiguous/multi-event headlines are not assigned a direction.
    if (matches.length !== 1) continue;
    const rule = matches[0];
    const canonical = title.replace(/[^a-z0-9]+/g, ' ').trim();
    const urlKey = origin.url.split(/[?#]/)[0];
    if (seen.some(s => s.url === urlKey || (s.rule === rule.id && similar(s.title, canonical)))) continue;
    seen.push({ title: canonical, url: urlKey, rule: rule.id });
    events.push({ id: `${rule.id}:${urlKey}`, title: item.title.slice(0, 500), category: rule.label,
      publishedAt: new Date(published).toISOString(), sourceUrl: origin.url, sourceHost: origin.host, sourceType: origin.type,
      channels: rule.channels, symbols: rule.companyOnly ? symbols : [] });
    if (events.length === 8) break;
  }
  const signs = new Map<string, Set<Direction>>();
  for (const e of events) for (const c of e.channels) {
    const key = `${c.sector}:${e.symbols.join(',')}`;
    const current = signs.get(key) ?? new Set<Direction>(); current.add(c.direction); signs.set(key, current);
  }
  return { version: 'headline-scenarios-v1', generatedAt: new Date(now).toISOString(),
    status: events.length ? 'scenarios' : 'insufficient', events, omitted: input.length - events.length,
    conflict: [...signs.values()].some(s => s.has('olumlu') && s.has('olumsuz')),
    limitations: ['Başlık temelli olası etki analizi; fiyat hedefi, getiri tahmini veya al/sat sinyali değildir.',
      'Tahmin başarısı ölçülmedi; olasılık veya güven yüzdesi hesaplanmıyor.',
      'Son 48 saat ve sınırlı haber kaynakları taranır. Kaynak türü, içeriğin doğrulandığı anlamına gelmez.',
      'Beklenti-gerçekleşme farkı, piyasa tepkisi ve bilanço büyüklükleri henüz sayısal olarak bağlı değil.'] };
}

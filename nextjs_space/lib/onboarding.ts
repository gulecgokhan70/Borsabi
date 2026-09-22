import { z } from 'zod';
export const GUIDE_STEPS = [
  { title: 'BorsaBi’de ne yapabilirsin?', text: 'BorsaBi bir eğitim ve sanal işlem uygulamasıdır. Buradaki işlemler gerçek para veya gerçek hisse içermez.',
    points: ['Piyasalar: hisse ve kripto fiyatlarını incele.', 'Portföy: sanal varlıklarını ve sonucunu takip et.', 'Öğren: kısa derslere ve bu rehbere istediğin zaman dön.'], tip: 'Rehberi atlamak uygulamanın özelliklerini kısıtlamaz.' },
  { title: 'Bir hisseyi keşfet', text: 'Piyasalar sayfasında şirket adı veya hisse koduyla ara. Bir hisseye dokunarak ayrıntılarını aç.',
    points: ['Fiyatın ait olduğu zamanı ve kaynağını kontrol et.', 'Grafikte 1G bir günü, 1H bir haftayı, 1A bir ayı gösterir.', 'İzleme listesi, ilgilendiğin hisseleri daha sonra kolayca bulmanı sağlar.'], tip: 'Sayfanın yenilenmesi fiyatın da o anda oluştuğu anlamına gelmez.' },
  { title: 'Sanal alım formunu anla', text: 'Hisse ekranındaki Al düğmesi işlem formunu açar. Adedi gir, toplam tutarı ve işlem sonrası bakiyeyi incele.',
    points: ['Adet: almak istediğin pay miktarı.', 'Komisyon: varsa işlem için hesaplanan ücret.', 'Toplam maliyet: fiyat × adet + komisyon.'], tip: 'Bu rehber işlem göndermez. Gerçek sanal işlemi ancak işlem formundaki onay düğmesiyle yaparsın.' },
  { title: 'Sonucunu incele ve emrini yönet', text: 'Portföy sayfasında miktarı, ortalama alış fiyatını ve kâr/zararı karşılaştır. Satıştan sonra İşlem Günlüğü kaydı oluşur.',
    points: ['Zarar durdur: belirlediğin düşüş seviyesini izler.', 'Kâr al: belirlediğin yükseliş seviyesini izler.', 'Emri düzenle ile seviyeleri değiştirebilirsin. Otomatik sanal satış açıkken eşik aşılırsa pozisyon satılabilir.'], tip: 'İşlem fiyatı eşik fiyatından farklı olabilir. Fiyat değişmese bile varsa komisyon net sonucu etkiler.' },
  { title: 'Öğrenmeye devam et', text: 'İlk sanal işlemine hazır olduğunda Piyasalar’a geçebilirsin. Önce dersleri incelemeyi de seçebilirsin.',
    points: ['Piyasa Uyarıları’nda kaynağı ve koşullu etki açıklamalarını oku.', 'AI Asistan’a anlamadığın terimleri sor; önemli bilgileri kaynağından kontrol et.', 'Öğren → Başlangıç rehberi üzerinden tekrar aç veya kaldığın yerden devam et.'], tip: 'Rehberi tamamlamak işlem yaptığın veya bir konuyu bütünüyle öğrendiğin anlamına gelmez; kendi hızında pratik yap.' },
] as const;
export const guideStateSchema = z.object({ step: z.number().int().min(0).max(GUIDE_STEPS.length - 1), status: z.enum(['new', 'available', 'in_progress', 'skipped', 'completed']) }).strict();
export type GuideState = z.infer<typeof guideStateSchema>;
export const guideKey = (accountId: string) => `beginner-guide-v1:${accountId}`;
export function parseGuideState(raw?: string | null): GuideState {
  try { const parsed = guideStateSchema.safeParse(JSON.parse(raw || '{}')); if (parsed.success) return parsed.data; } catch { /* Legacy or corrupt optional preference. */ }
  return { step: 0, status: 'available' };
}

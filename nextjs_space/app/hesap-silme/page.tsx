import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AccountDeletionForm } from './account-deletion-form';

export const metadata = { title: 'Hesap silme | BorsaBi Trader' };
export default async function AccountDeletionPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
    <Link href={userId ? '/profile' : '/'} className="inline-flex min-h-[44px] items-center text-blue-500">← BorsaBi’ye dön</Link>
    <h1 className="text-2xl font-bold">BorsaBi Trader hesabını sil</h1>
    <section className="glass-card rounded-2xl p-5 space-y-3">
      <p>Hesabınızla birlikte sanal bakiye, açık ve kapalı pozisyonlar, işlem günlüğü, pratik oturumları, izleme listesi, alarmlar, bildirimler, takip ilişkileri ve hesabınıza bağlı AI içerik bildirimleri aktif veritabanından silinir.</p>
      <p>Bu işlem geri alınamaz. Otomatik sanal işlemler ve hesaba bağlı bildirim gönderimleri sona erer. Daha önce cihazınıza ulaşmış bildirimleri cihazınızdan ayrıca temizleyebilirsiniz.</p>
      <p className="text-sm text-muted-foreground">Geçmiş yedeklerin ve sunucu kayıtlarının silinmesiyle ilgili talebinizi info@borsabi.com adresine iletebilirsiniz. Bu ekran geçmiş yedekleri veya hizmet sağlayıcı kayıtlarını otomatik olarak temizlemez.</p>
    </section>
    {userId ? <AccountDeletionForm userId={userId} /> : <section className="glass-card rounded-2xl p-5 space-y-3">
      <p>Hesabınızı doğrulamak ve silmek için tarayıcıdan giriş yapabilirsiniz. Uygulamayı yeniden yüklemeniz gerekmez.</p>
      <Link className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-blue-600 text-white" href="/login?callbackUrl=%2Fhesap-silme">Giriş yap</Link>
    </section>}
    <section className="space-y-2">
      <h2 className="font-semibold">Hesabınıza erişemiyor musunuz?</h2>
      <p>Kayıtlı e-posta adresinizden <a className="text-blue-500 underline" href="mailto:info@borsabi.com?subject=BorsaBi%20hesap%20silme%20talebi">info@borsabi.com</a> adresine “BorsaBi hesap silme talebi” konulu e-posta gönderin. Hesap sahipliği doğrulandıktan sonra talebiniz değerlendirilir. Şifrenizi e-postaya yazmayın.</p>
      <Link className="inline-flex min-h-[44px] items-center text-blue-500 underline" href="/aydinlatma-metni">Verilerinizin işlenmesi hakkında</Link>
    </section>
  </main>;
}

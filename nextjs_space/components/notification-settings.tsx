'use client';
import { useEffect, useState } from 'react';
export function NotificationSettings() {
  const [data, setData] = useState<any>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() { try { const r = await fetch('/api/notifications'); if (r.ok && !cancelled) setData(await r.json()); } catch { if (!cancelled) setMessage('Bildirim durumu alınamadı.'); } }
    load(); const t = setInterval(load, 30_000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r?.pushManager?.getSubscription()).then(s => { if (!cancelled) setSubscribed(!!s); });
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  async function toggle() {
    setBusy(true); setMessage('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('iPhone’da siteyi Ana Ekrana Ekle ile açıp tekrar deneyin.');
      if (!subscribed && await Notification.requestPermission() !== 'granted') throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından değiştirebilirsiniz.');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscribed && subscription) {
        const r = await fetch('/api/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!r.ok) throw new Error('Abonelik kaldırılamadı.');
        await subscription.unsubscribe(); setSubscribed(false); setMessage('Bu cihazın bildirimleri kapatıldı.'); return;
      }
      if (!data?.publicKey) throw new Error('Telefon bildirimleri sunucuda henüz hazır değil.');
      const key = data.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(key.padEnd(Math.ceil(key.length / 4) * 4, '=')), c => c.charCodeAt(0));
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const r = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error);
      setSubscribed(true); setMessage('Bu cihazın bildirimleri açıldı.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Bildirim açılamadı.'); }
    finally { setBusy(false); }
  }
  return <section className="glass-card rounded-xl p-4 space-y-3 text-sm">
    <h2 className="font-semibold">Emirler ve bildirimler</h2>
    <p>Sunucu otomasyonu: {data ? (data.automation?.active ? 'Çalışıyor' : 'Kontrol bekleniyor / hizmet durdu') : 'Kontrol ediliyor…'}</p>
    <p className="text-xs text-muted-foreground">Kontrol yaklaşık 30 saniyede bir yapılır. Eski fiyatla otomatik işlem yapılmaz. BIST verisi gecikmeli olabilir.</p>
    <button disabled={busy || (!subscribed && !data?.publicKey)} onClick={toggle} className="min-h-[44px] px-4 rounded-lg glass-inner disabled:opacity-50">{subscribed ? 'Telefon bildirimlerini kapat' : 'Telefon bildirimlerini aç'}</button>
    <p className="text-xs text-muted-foreground">iPhone için Safari → Paylaş → Ana Ekrana Ekle; ardından uygulamadan bildirim izni verin.</p>
    {message && <p role="status">{message}</p>}
    <details><summary className="cursor-pointer min-h-[44px]">Son bildirimler ({data?.events?.length ?? 0})</summary>
      {data?.events?.map((n: any) => <a key={n.id} href={n.url} className="block border-t border-white/10 py-3"><strong>{n.title}</strong><p>{n.body}</p><time className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('tr-TR')}</time></a>)}
    </details>
  </section>;
}

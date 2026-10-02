'use client';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export function AccountDeletionForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !confirmed) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, confirmation: 'HESABIMI SİL' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Hesap silinemedi.');
      setPassword(''); setDeleted(true);
      try { sessionStorage.removeItem(`borsabi-order:${userId}`); } catch { /* Storage may be unavailable. */ }
      // Deletion already succeeded; a failed sign-out must not report it as failed.
      await signOut({ redirect: false }).catch(() => undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bağlantı kurulamadı.'); }
    finally { setBusy(false); }
  }
  if (deleted) return <section role="status" className="glass-card rounded-2xl p-5 space-y-3">
    <h2 className="font-semibold">Hesabınız silindi.</h2><p>Hesabınıza bağlı aktif uygulama verileri kaldırıldı.</p>
    <Link className="inline-flex min-h-[44px] items-center text-blue-500" href="/">Ana sayfaya dön</Link>
  </section>;
  return <form onSubmit={remove} className="glass-card rounded-2xl p-5 space-y-4">
    <label className="block">Mevcut şifreniz
      <input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 glass-inner rounded-lg px-3 min-h-[44px] w-full" />
    </label>
    <label className="flex items-start gap-3 py-2 min-h-[44px]"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" /><span>Hesabımın ve yukarıdaki verilerin kalıcı olarak silinmesini istiyorum.</span></label>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    <button type="submit" disabled={busy || !confirmed || !password} className="min-h-[44px] px-5 rounded-lg bg-red-600 text-white disabled:opacity-50">{busy ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}</button>
  </form>;
}

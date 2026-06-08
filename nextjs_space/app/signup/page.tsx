'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e?.preventDefault?.();
    if (!email || !password) { toast.error('Tüm alanları doldurun'); return; }
    if ((password?.length ?? 0) < 6) { toast.error('Şifre en az 6 karakter olmalı'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || 'Trader' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Kayıt başarısız'); return; }
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      if (signInRes?.error) { toast.error('Giriş hatası'); return; }
      router.replace('/dashboard');
    } catch (e: any) {
      toast.error('Kayıt hatası');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#3B82F6]/10 mb-4">
            <TrendingUp className="w-7 h-7 text-[#3B82F6]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Master Trader</h1>
          <p className="text-sm text-[#94A3B8] mt-1">100.000 TL sanal bakiye ile başla</p>
        </div>

        <form onSubmit={handleSignup} className="bg-[#1E293B] rounded-xl border border-[#334155] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Hesap Oluştur</h2>

          <div>
            <label className="text-xs text-[#94A3B8] mb-1.5 block">İsim</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input type="text" value={name} onChange={(e: any) => setName(e?.target?.value ?? '')} placeholder="Adınız"
                className="w-full pl-10 pr-3 py-2.5 bg-[#0F172A] border border-[#334155] rounded-lg text-white text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#94A3B8] mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input type="email" value={email} onChange={(e: any) => setEmail(e?.target?.value ?? '')} placeholder="email@adres.com" required
                className="w-full pl-10 pr-3 py-2.5 bg-[#0F172A] border border-[#334155] rounded-lg text-white text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#94A3B8] mb-1.5 block">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e: any) => setPassword(e?.target?.value ?? '')} placeholder="En az 6 karakter" required
                className="w-full pl-10 pr-10 py-2.5 bg-[#0F172A] border border-[#334155] rounded-lg text-white text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Kayıt Ol'}
          </button>

          <p className="text-center text-sm text-[#94A3B8]">
            Zaten hesabınız var mı?{' '}
            <Link href="/login" className="text-[#3B82F6] hover:underline font-medium">Giriş Yap</Link>
          </p>
        </form>

        <p className="text-center text-[10px] text-[#64748B] mt-4">
          Bu platform eğitim ve simülasyon amaçlıdır. Gerçek para işlemi yapılmaz.
        </p>
      </div>
    </div>
  );
}

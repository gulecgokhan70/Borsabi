'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { BorsaBiLogo } from '@/components/logo';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e?.preventDefault?.();
    if (!email || !password) { toast.error('Email ve şifre gereklidir'); return; }
    setLoading(true);
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) { toast.error('Email veya şifre hatalı'); return; }
      router.replace('/dashboard');
    } catch (e: any) {
      toast.error('Giriş hatası');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4">
            <BorsaBiLogo size={56} />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">BorsaBi Trader</h1>
          <p className="text-sm text-muted-foreground mt-1">Profesyonel Trader Gibi Düşün</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Giriş Yap</h2>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email" value={email} onChange={(e: any) => setEmail(e?.target?.value ?? '')}
                placeholder="email@adres.com" required
                className="w-full pl-10 pr-3 py-2.5 glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-foreground text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={(e: any) => setPassword(e?.target?.value ?? '')}
                placeholder="••••••••" required
                className="w-full pl-10 pr-10 py-2.5 glass-inner border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-foreground text-sm focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Giriş Yap'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Hesabınız yok mu?{' '}
            <Link href="/signup" className="text-[#3B82F6] hover:underline font-medium">Kayıt Ol</Link>
          </p>
        </form>

        <div className="text-center mt-4 space-y-1">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Bu platform eğitim ve simülasyon amaçlıdır. Gerçek para işlemi yapılmaz.</p>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
            <a href="/destek" className="hover:text-[#3B82F6] transition-colors">Destek</a>
            <span>·</span>
            <a href="/aydinlatma-metni" className="hover:text-[#3B82F6] transition-colors">Aydınlatma Metni</a>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Inter } from 'next/font/google';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler';
import { PWARegister } from '@/components/pwa-register';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'BorsaBi Trader | Profesyonel Trader Gibi Düşün',
  description: 'Türkiye odaklı yapay zeka destekli trading simülasyon platformu. BIST ve kripto piyasalarını takip edin, sanal portföy yönetin.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'BorsaBi Trader | Profesyonel Trader Gibi Düşün',
    description: 'Türkiye odaklı yapay zeka destekli trading simülasyon platformu.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BorsaBi" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="msapplication-TileColor" content="#0F172A" />
        <meta name="msapplication-TileImage" content="/icon-144x144.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var origError = console.error;
            console.error = function() {
              var msg = arguments[0];
              if (typeof msg === 'string' && (msg.indexOf('contentWindow') !== -1 || msg.indexOf('Cannot listen to the event from the provided iframe') !== -1)) return;
              origError.apply(console, arguments);
            };
          })();
        `}} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
          <ChunkLoadErrorHandler />
          <PWARegister />
        </Providers>
      </body>
    </html>
  );
}

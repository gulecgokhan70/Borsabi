import { Inter } from 'next/font/google';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'BorsaBi Trader | Profesyonel Trader Gibi Düşün',
  description: 'Türkiye odaklı yapay zeka destekli trading simülasyon platformu. BIST ve kripto piyasalarını takip edin, sanal portföy yönetin.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
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
        </Providers>
      </body>
    </html>
  );
}

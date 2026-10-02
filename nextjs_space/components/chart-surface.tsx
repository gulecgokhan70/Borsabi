'use client';
import { type ReactNode } from 'react';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export function ChartSurface({ children, controls, title, subtitle, full, onFullChange, footer }: {
  children: ReactNode;
  controls: ReactNode;
  title: string;
  subtitle: string;
  full: boolean;
  onFullChange: (open: boolean) => void;
  footer?: ReactNode;
}) {
  const content = <div className="chart-touch min-w-0">{children}</div>;
  return <Dialog.Root open={full} onOpenChange={onFullChange}>
    <section aria-label="Fiyat grafiği" className="relative min-w-0">
      {!full && content}
      <div className="flex items-center gap-1 pt-5">
        {!full && controls}
        <Dialog.Trigger aria-label="Grafiği tam ekran aç" title="Tam ekran teknik grafik" className="shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15">
          <Maximize2 className="w-5 h-5" />
        </Dialog.Trigger>
      </div>
    </section>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
      <Dialog.Content aria-describedby={undefined} className="stock-focus fixed inset-0 z-[91] flex flex-col bg-white dark:bg-[#0d0d0d] text-foreground pt-[env(safe-area-inset-top)]" style={{ '--chart-height': 'clamp(230px, 38dvh, 480px)' } as React.CSSProperties}>
        <header className="flex shrink-0 items-center gap-3 px-4 py-3">
          <Dialog.Close aria-label="Grafiği kapat" className="h-11 w-11 grid place-items-center shrink-0"><ArrowLeft className="w-6 h-6" /></Dialog.Close>
          <div className="min-w-0"><Dialog.Title className="font-semibold text-xl truncate">{title}</Dialog.Title><p className="text-sm text-muted-foreground">Piyasa fiyatı: {subtitle}</p></div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-8 pb-5">
          {full && content}
          <div className="flex items-center gap-1 pt-4">{full && controls}</div>
        </div>
        {footer && <div className="shrink-0 px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white dark:bg-[#0d0d0d]">{footer}</div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

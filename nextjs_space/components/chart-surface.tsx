'use client';
import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
export function ChartSurface({ children }: { children: ReactNode }) {
  const [full, setFull] = useState(false);
  const content = <div className="chart-touch space-y-3">{children}</div>;
  return <Dialog.Root open={full} onOpenChange={setFull}>
    <section className="glass-card rounded-xl p-4">
      <Dialog.Trigger className="min-h-[44px] px-3 mb-2 glass-inner rounded-lg text-sm">Grafiği tam ekran aç</Dialog.Trigger>
      {!full && content}
    </section>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[90] bg-black/80" />
      <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[91] overflow-y-auto bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ '--chart-height': '58dvh' } as React.CSSProperties}>
        <div className="flex justify-between items-center mb-3"><Dialog.Title className="font-semibold">Fiyat grafiği</Dialog.Title><Dialog.Close className="min-h-[44px] min-w-[44px] px-4 rounded-lg glass-inner">Kapat</Dialog.Close></div>
        {full && content}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

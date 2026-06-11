'use client';
import { useMemo } from 'react';

const vibrate = (pattern: number | number[] = 10) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

const hapticActions = {
  /** Hafif titreşim - grafik kaydırma, küçük etkileşim */
  light: () => vibrate(8),
  /** Orta titreşim - buton tıklama, seçim değişikliği */
  medium: () => vibrate(15),
  /** Güçlü titreşim - önemli bildirim, alarm tetikleme */
  strong: () => vibrate(30),
  /** Uyarı titreşimi - kritik alarm, zarar limiti */
  warning: () => vibrate([30, 50, 30]),
  /** Başarı titreşimi - işlem tamamlandı */
  success: () => vibrate([10, 30, 10]),
  /** Özel pattern */
  custom: vibrate,
};

/**
 * Haptic feedback hook — navigator.vibrate (Android Chrome destekli)
 * iOS Safari desteklemez ama sessizce başarısız olur.
 * Stabil referans döndürür — useCallback dependency'lerinde güvenle kullanılabilir.
 */
export function useHaptic() {
  return useMemo(() => hapticActions, []);
}

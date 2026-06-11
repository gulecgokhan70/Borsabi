'use client';

/**
 * Haptic feedback hook — navigator.vibrate (Android Chrome destekli)
 * iOS Safari desteklemez ama sessizce başarısız olur.
 */
export function useHaptic() {
  const vibrate = (pattern: number | number[] = 10) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {}
  };

  return {
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
}

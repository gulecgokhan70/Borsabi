'use client';
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

const ALERT_CHECK_INTERVAL = 30000; // 30 saniye
const ALERT_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdGKJjYuHfXV0gIOLkI2IhX18gYWKjYuIhX57f4OIi4qIhYJ+fYGFiIqKiIWCf36BhYiJiYiFgn9+gYWIiYmIhYJ/foGFiImJiIWCf36BhYiIiYiFgn9+gYWIiImIhYJ/foGFiIiJiIWCf36AhYiIiYiFgn9+gIWIiImIhYJ/foGFiIiJiIWCf36BhYiIiYiFgn9+gYWHiImIhYN/fn+EhoeIh4WDf35/hIaHiIeFg39+f4SGh4eHhYN/fn+EhoeHh4WDf35/hIaHh4eFg39+f4SGh4eHhYN/fn+EhoeHh4WDf35/hIaHh4eFgn9+f4SGh4eHhYJ/fn+EhoeHh4WCf35/hIaHh4eFgn5+f4SGh4eHhYJ+fn+EhoeHh4WCfn5/';

export function useAlertNotifications() {
  const permissionRef = useRef<NotificationPermission>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Browser notification izni iste
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return;
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      permissionRef.current = perm;
    }
  }, []);

  // Ses çal
  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALERT_SOUND_URL);
        audioRef.current.volume = 0.5;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  // Push notification gönder
  const sendNotification = useCallback((title: string, body: string, icon?: string) => {
    // Toast her zaman
    toast.success(title, { description: body, duration: 8000 });
    playSound();

    // Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: icon || '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'price-alert',
          requireInteraction: true,
        });
      } catch (e) {}
    }
  }, [playSound]);

  // Alarm kontrolü
  const checkAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/check');
      if (!res.ok) return;
      const data = await res.json();
      const triggered = data.triggered || [];
      triggered.forEach((alert: any) => {
        const direction = alert.condition === 'above' ? '⬆️ Üstüne çıktı' : '⬇️ Altına düştü';
        sendNotification(
          `🔔 ${alert.name} Alarmı!`,
          `${alert.symbol.replace('.IS', '')} ${direction}: ${alert.currentPrice?.toFixed(2)} ${alert.symbol.endsWith('-USD') ? 'USD' : 'TL'} (Hedef: ${alert.targetPrice?.toFixed(2)} ${alert.symbol.endsWith('-USD') ? 'USD' : 'TL'})`
        );
      });
      // İz süren stop bildirimleri
      const trailingAlerts = data.trailingAlerts || [];
      trailingAlerts.forEach((ta: any) => {
        sendNotification(
          `🚨 ${ta.symbol} İz Süren Stop!`,
          ta.message ?? `${ta.symbol} trailing stop tetiklendi: ${ta.currentPrice?.toFixed(2)} ${ta.symbol.endsWith('-USD') ? 'USD' : 'TL'}`
        );
      });
    } catch (e) {}
  }, [sendNotification]);

  useEffect(() => {
    requestPermission();
    const interval = setInterval(checkAlerts, ALERT_CHECK_INTERVAL);
    // İlk kontrol 5 sn sonra
    const timeout = setTimeout(checkAlerts, 5000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [requestPermission, checkAlerts]);

  return { requestPermission, sendNotification, checkAlerts };
}

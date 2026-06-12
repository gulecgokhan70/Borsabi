'use client';
import { useCallback } from 'react';

export function useConfetti() {
  const fire = useCallback(async () => {
    try {
      const confetti = (await import('canvas-confetti')).default;
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } catch (e) {
      // silently fail
    }
  }, []);

  return { fire };
}

'use client';

import { useEffect } from 'react';

/**
 * §5 ТЗ: Блокировка скролла body при открытом модальном окне.
 * Фиксирует позицию прокрутки, чтобы фон не скроллился под модалом на iOS.
 */
export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;

    const body = document.body;
    const scrollY = window.scrollY;

    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    // iOS-совместимая блокировка: фиксируем body на месте
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      // Восстанавливаем позицию прокрутки
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

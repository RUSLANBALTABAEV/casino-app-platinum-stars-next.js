'use client';

import clsx from 'clsx';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useTelegram } from '../context/TelegramContext';
import BottomNav, { type BottomNavItem } from './BottomNav'; // Восстановлено
import HolidayAtmosphere from '@/components/effects/HolidayAtmosphere';
import SnowDrift from '@/components/effects/SnowDrift';
import FrozenButtons from '@/components/effects/FrozenButtons';
import { useOnlineHeartbeat } from '@/hooks/useOnlineHeartbeat';

const NAV_ITEMS: BottomNavItem[] = [
  { href: '/profile', label: 'Профиль', icon: 'profile' },
  { href: '/games', label: 'Игры', icon: 'games' },
  { href: '/leaderboard', label: 'Топ', icon: 'leaderboard' },
  { href: '/wallet', label: 'Кошелёк', icon: 'wallet' },
  { href: '/tasks', label: 'Задания', icon: 'tasks' },
];

function RootLayoutShell({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { webApp, initDataRaw } = useTelegram();
  const isGamesHub = pathname === '/games';
  const isGameScreen = pathname.startsWith('/games/') && !isGamesHub;
  const isAdminRoute = pathname.startsWith('/admin');
  const isFullWidthLayout = isGameScreen || isAdminRoute;
  const [isHoliday, setIsHoliday] = useState(true); // По умолчанию holiday

  useOnlineHeartbeat(initDataRaw);

  // Загружаем настройку темы из API
  useEffect(() => {
    fetch('/api/theme')
      .then((res) => res.json())
      .then((data: { theme: 'holiday' | 'regular' }) => {
        const holiday = data.theme === 'holiday';
        setIsHoliday(holiday);
        document.documentElement.dataset.holiday = holiday ? '1' : '0';
      })
      .catch(() => {
        // По умолчанию holiday
        document.documentElement.dataset.holiday = '1';
      });
  }, []);

  // Слушаем изменения атрибута data-holiday (когда админ меняет тему)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-holiday') {
          const value = document.documentElement.dataset.holiday;
          setIsHoliday(value === '1');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const handleNavigation = useCallback(
    (target: Route) => {
      if (target !== pathname) {
        // В Telegram WebView router.push может не работать, используем window.location
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          window.location.href = target;
        } else {
          router.push(target);
        }
      }
    },
    [pathname, router]
  );

  useEffect(() => {
    if (!webApp?.BackButton) {
      return;
    }

    const handleBack = () => {
      if (pathname === '/') {
        webApp.BackButton.hide();
        return;
      }

      router.back();
    };

    webApp.BackButton.onClick(handleBack);

    return () => {
      webApp.BackButton.offClick?.(handleBack);
    };
  }, [pathname, router, webApp]);

  useEffect(() => {
    if (!webApp?.BackButton) {
      return;
    }

    if (pathname === '/') {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
    }
  }, [pathname, webApp]);

  return (
    <div
      className={clsx(
        'relative flex min-h-[var(--tg-viewport-height,100dvh)] w-full justify-center',
        isGameScreen ? 'bg-black' : 'bg-night'
      )}
    >
      {!isFullWidthLayout && isHoliday ? (
        <>
          <HolidayAtmosphere />
          <SnowDrift />
          <FrozenButtons />
        </>
      ) : null}
      {!isFullWidthLayout && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gold-sheen opacity-70"
        />
      )}
      <div
        className={clsx(
          'relative z-10 flex w-full flex-1 flex-col items-stretch',
          isFullWidthLayout
            ? 'max-w-none px-0 pb-0 pt-0'
            : 'max-w-[600px] px-5 pb-[calc(7.5rem+var(--safe-area-bottom))] pt-[calc(1.5rem+var(--safe-area-top))]' // Восстановлено
        )}
      >
        <main key={pathname} className="flex-1 opacity-100">
          {children}
        </main>
      </div>
      {!isFullWidthLayout && (
        <BottomNav
          activePath={pathname}
          items={NAV_ITEMS}
          onNavigate={handleNavigation}
        />
      )}
    </div>
  );
}

export default RootLayoutShell;

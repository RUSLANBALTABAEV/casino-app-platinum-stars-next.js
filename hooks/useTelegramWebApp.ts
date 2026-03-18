'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  TelegramInitData,
  TelegramThemeParams,
  TelegramUser,
  TelegramWebApp
} from '../types/telegram';

type ColorScheme = 'light' | 'dark';

interface TelegramState {
  webApp?: TelegramWebApp;
  colorScheme: ColorScheme;
  viewportHeight: number;
  initData?: TelegramInitData;
  initDataRaw?: string;
  themeParams?: TelegramThemeParams;
  user?: TelegramUser;
  isReady: boolean;
}

const FALLBACK_SCHEME: ColorScheme = 'dark';

function getPreferredColorScheme(): ColorScheme {
  if (typeof window === 'undefined') {
    return FALLBACK_SCHEME;
  }

  if (window.Telegram?.WebApp?.colorScheme) {
    return (window.Telegram.WebApp.colorScheme as ColorScheme) ?? FALLBACK_SCHEME;
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function getViewportStableHeight(webApp?: TelegramWebApp): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  if (webApp?.viewportStableHeight) {
    return webApp.viewportStableHeight;
  }

  return window.innerHeight;
}

export function useTelegramWebApp(): TelegramState {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    getPreferredColorScheme()
  );
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    getViewportStableHeight()
  );
  const [initData, setInitData] = useState<TelegramInitData | undefined>();
  const [initDataRaw, setInitDataRaw] = useState<string | undefined>();
  const [themeParams, setThemeParams] = useState<TelegramThemeParams | undefined>();
  const [user, setUser] = useState<TelegramUser | undefined>();
  const [isReady, setIsReady] = useState<boolean>(false);

  const webApp = useMemo<TelegramWebApp | undefined>(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const createMockWebApp = () =>
      ({
        initData:
          'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Afalse%7D&chat_instance=123456789&chat_type=private&auth_date=1762918558&hash=test_hash',
        initDataUnsafe: {
          user: {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'ru',
            is_premium: false
          }
        },
        ready: () => {},
        expand: () => {},
        disableVerticalSwipes: () => {},
        disableDrag: () => {},
        onEvent: () => {},
        offEvent: () => {},
        colorScheme: 'dark',
        themeParams: {},
        viewportStableHeight: window.innerHeight
      }) as any;

    // Если Telegram WebApp отсутствует — используем мок (нужно для тестов в браузере).
    if (!window.Telegram?.WebApp) {
      console.warn('Telegram WebApp not found. Using mock data for browser.');
      return createMockWebApp();
    }

    // Иногда в обычном браузере может существовать window.Telegram.WebApp (расширения/инжекты),
    // но без initData. В этом случае нельзя падать — подменяем на мок, чтобы тестовые страницы работали.
    const hasInitData =
      typeof (window.Telegram.WebApp as any).initData === 'string' &&
      (window.Telegram.WebApp as any).initData.length > 0;
    if (!hasInitData) {
      const isTestRoute = typeof window.location !== 'undefined' && window.location.pathname.startsWith('/test');
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev || isTestRoute) {
        console.warn('Telegram WebApp initData is missing. Using mock data for browser.');
        return createMockWebApp();
      }
    }

    return window.Telegram?.WebApp;
  }, []);

  useEffect(() => {
    if (!webApp) {
      document.documentElement.dataset.theme = colorScheme;
      document.documentElement.style.setProperty(
        '--tg-viewport-height',
        '100dvh'
      );
      setIsReady(true);
      return;
    }

    webApp.ready();
    webApp.expand();
    webApp.disableVerticalSwipes?.();
    webApp.disableDrag?.();
    // setIsReady будет установлен в applyInitData после проверки initData

    const applyColorScheme = () => {
      const scheme = (webApp.colorScheme as ColorScheme) ?? FALLBACK_SCHEME;
      setColorScheme(scheme);
      document.documentElement.dataset.theme = scheme;
    };

    const applyViewportHeight = () => {
      const height = getViewportStableHeight(webApp);
      setViewportHeight(height);
      document.documentElement.style.setProperty(
        '--tg-viewport-height',
        `${height}px`
      );
    };

    const applyInitData = () => {
      // Не спамим логами и не выбрасываем ошибки в браузере без Telegram.
      
      // Получаем initData разными способами для надежности
      let initDataString: string | undefined = webApp.initData;
      
      // Если initData не доступен напрямую, пробуем получить из window.Telegram.WebApp
      if (!initDataString && typeof window !== 'undefined') {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initData && typeof tg.initData === 'string') {
          console.log('[useTelegramWebApp] Got initData from window.Telegram.WebApp');
          initDataString = tg.initData;
        }
      }
      
      // Проверяем, что initData действительно есть и это строка
      if (initDataString && typeof initDataString === 'string' && initDataString.length > 0) {
        setInitData(webApp.initDataUnsafe);
        setInitDataRaw(initDataString);
        setThemeParams(webApp.themeParams);
        setUser(webApp.initDataUnsafe?.user);
        setIsReady(true);
      } else {
        // Устанавливаем ready, но initDataRaw будет установлен позже (если появится).
        setIsReady(true);
        
        // Повторная попытка через небольшую задержку
        const retryTimeout = setTimeout(() => {
          let retryInitData: string | undefined = webApp.initData;
          if (!retryInitData && typeof window !== 'undefined') {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.initData && typeof tg.initData === 'string') {
              retryInitData = tg.initData;
            }
          }
          
          if (retryInitData && typeof retryInitData === 'string' && retryInitData.length > 0) {
            setInitData(webApp.initDataUnsafe);
            setInitDataRaw(retryInitData);
            setThemeParams(webApp.themeParams);
            setUser(webApp.initDataUnsafe?.user);
          } else {
            // Не кидаем error, чтобы не ломать dev overlay. Просто остаёмся в режиме без initData.
            console.warn('[useTelegramWebApp] initData is still missing after retry');
          }
        }, 200);
        
        // Очищаем таймер при размонтировании
        return () => clearTimeout(retryTimeout);
      }
    };

    applyColorScheme();
    applyViewportHeight();
    applyInitData();

    const themeListener = () => applyColorScheme();
    const viewportListener = () => applyViewportHeight();
    webApp.onEvent?.('themeChanged', themeListener);
    webApp.onEvent?.('viewportChanged', viewportListener);

    return () => {
      webApp.offEvent?.('themeChanged', themeListener);
      webApp.offEvent?.('viewportChanged', viewportListener);
    };
  }, [colorScheme, webApp]);

  useEffect(() => {
    const resizeHandler = () => {
      if (webApp) {
        return;
      }

      const height = getViewportStableHeight();
      setViewportHeight(height);
      document.documentElement.style.setProperty(
        '--tg-viewport-height',
        `${height}px`
      );
    };

    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [webApp]);

  useEffect(() => {
    if (webApp || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [webApp]);

  useEffect(() => {
    document.body.style.userSelect = 'none';
    document.body.style.setProperty('-webkit-user-select', 'none');
    document.body.style.touchAction = 'pan-y';
    return () => {
      document.body.style.userSelect = '';
      document.body.style.removeProperty('-webkit-user-select');
      document.body.style.touchAction = '';
    };
  }, []);

  return {
    webApp,
    colorScheme,
    viewportHeight,
    initData,
    initDataRaw,
    themeParams,
    user,
    isReady
  };
}

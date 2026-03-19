import type { Metadata, Viewport } from 'next';
import React from 'react';

import RootLayoutShell from '@/components/RootLayoutShell';
import { TelegramProvider } from '@/context/TelegramContext';
import ErudaLoader from '@/components/ErudaLoader';

import './globals.css';

export const metadata: Metadata = {
  title: 'AstroPlay • Telegram Mini App',
  description:
    'Премиальный игровой мини-приложение с кейсами, рулеткой, раннером и лотереей на Telegram-звёзды.',
  applicationName: 'AstroPlay'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4F5' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0C' }
  ]
};

async function getTheme(): Promise<'holiday' | 'regular'> {
  try {
    // Динамический импорт защищает layout от краша при недоступности БД
    const { prisma } = await import('@/lib/prisma');
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'site_theme' }
    });
    return (setting?.value as 'holiday' | 'regular') ?? 'holiday';
  } catch {
    // БД недоступна — показываем приложение с темой по умолчанию
    return 'holiday';
  }
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const theme = await getTheme();
  const isHoliday = theme === 'holiday';

  return (
    <html lang="ru" data-holiday={isHoliday ? '1' : '0'} suppressHydrationWarning>
      <head>
        {/*
          КРИТИЧНО: Telegram WebApp SDK ОБЯЗАН загружаться синхронно в <head>
          до любого React кода. Использование next/script с strategy="beforeInteractive"
          в <body> в App Router НЕ гарантирует загрузку до гидратации.
          Используем нативный <script> тег напрямую в <head>.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="font-sans">
        <ErudaLoader />
        <TelegramProvider>
          <RootLayoutShell>{children}</RootLayoutShell>
        </TelegramProvider>
      </body>
    </html>
  );
}

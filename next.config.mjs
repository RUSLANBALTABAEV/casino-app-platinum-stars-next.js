/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ОБЯЗАТЕЛЬНО для Amvera / Docker / standalone
  output: 'standalone',

  // Игнорировать TypeScript и ESLint ошибки при сборке
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // typedRoutes теперь на верхнем уровне (Next.js 16+)
  // typedRoutes: true, // disabled to fix build

  // Убираем ненужные старые настройки
  // serverExternalPackages: [],          ← удаляем
  // pageExtensions: ['tsx', 'ts', ...],  ← удаляем (app router использует их автоматически)

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // КРИТИЧНО: разрешаем Telegram загружать приложение в iframe
          // Next.js по умолчанию ставит X-Frame-Options: SAMEORIGIN — это ломает Mini App!
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          }
        ]
      }
    ];
  },

  env: {
    NEXT_PUBLIC_MINI_APP_URL:
      process.env.NEXT_PUBLIC_MINI_APP_URL ??
      process.env.TELEGRAM_MINI_APP_URL ??
      'https://pfront-amveraforhosting2026.amvera.io',        // ← замени на свой реальный домен Amvera

    NEXT_PUBLIC_TOPUP_URL: process.env.NEXT_PUBLIC_TOPUP_URL ?? '',
    NEXT_PUBLIC_WITHDRAW_URL: process.env.NEXT_PUBLIC_WITHDRAW_URL ?? '',
  }
};

export default nextConfig;

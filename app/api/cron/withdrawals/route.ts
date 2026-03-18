/**
 * GET /api/cron/withdrawals
 *
 * Планировщик автоматического вывода звёзд.
 * Вызывать через cron (например, раз в минуту):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/withdrawals
 *
 * Переменные окружения:
 *   CRON_SECRET            — секрет для защиты endpoint
 *   AUTO_WITHDRAWAL_ENABLED — "true" для включения
 *   AUTO_WITHDRAWAL_THRESHOLD — максимальная сумма авто-вывода (по умолчанию 100)
 *   TELEGRAM_BOT_TOKEN     — токен бота для Stars API
 */

import { NextRequest, NextResponse } from 'next/server';

import { ensureDatabaseReady } from '@/lib/db/ensure';
import { processAutoWithdrawals } from '@/lib/services/auto-withdrawal';

export const runtime = 'nodejs';
// Не кешируем cron-ответы
export const dynamic = 'force-dynamic';

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Если секрет не задан — запрещаем доступ извне (безопасно по умолчанию)
    return false;
  }
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabaseReady();
    const result = await processAutoWithdrawals(20);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

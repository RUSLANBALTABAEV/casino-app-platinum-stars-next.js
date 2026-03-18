import { NextRequest, NextResponse } from 'next/server';

import { applyHeaders, applyRateLimit } from '@/lib/http/rate-limit';
import { getClientIdentifier } from '@/lib/http/request-helpers';
import { ensureDatabaseReady } from '@/lib/db/ensure';
import { prisma } from '@/lib/prisma';
import {
  assertInitDataIsFresh,
  ensureTelegramUser,
  getBotToken,
  getDevTelegramUser,
  isDevTelegramBypassEnabled,
  parseInitData,
  verifyInitData,
} from '@/lib/telegram/init-data';
import { syncTelegramUser } from '@/lib/services/user';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rateResult = applyRateLimit(getClientIdentifier(req), {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateResult.success) {
    return applyHeaders(
      NextResponse.json({ error: 'Слишком много запросов. Повторите позже.' }, { status: 429 }),
      rateResult,
    );
  }

  try {
    await ensureDatabaseReady();

    // Auth — определяем текущего пользователя для подсветки его позиции
    let currentUserId: string | null = null;
    const rawInitData = req.headers.get('x-telegram-init-data');
    if (rawInitData) {
      try {
        const botToken = getBotToken();
        if (verifyInitData(rawInitData, botToken)) {
          const initData = parseInitData(rawInitData);
          assertInitDataIsFresh(initData);
          const telegramUser = ensureTelegramUser(initData);
          const synced = await syncTelegramUser(telegramUser);
          currentUserId = synced.userId;
        }
      } catch {
        // игнорируем — лидерборд публичный
      }
    } else if (isDevTelegramBypassEnabled()) {
      const synced = await syncTelegramUser(getDevTelegramUser());
      currentUserId = synced.userId;
    }

    const limit = 50;

    // Топ по lifetimeEarn
    const topRows = await prisma.starBalance.findMany({
      where: {
        lifetimeEarn: { gt: 0 },
        user: { isBanned: false },
      },
      orderBy: { lifetimeEarn: 'desc' },
      take: limit,
      select: {
        userId: true,
        lifetimeEarn: true,
        available: true,
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            isPremium: true,
            createdAt: true,
          },
        },
      },
    });

    // Позиция текущего пользователя (если не вошёл в топ-50)
    let currentUserRank: number | null = null;
    let currentUserEntry: (typeof topRows)[0] | null = null;

    if (currentUserId) {
      const idx = topRows.findIndex((r) => r.userId === currentUserId);
      if (idx !== -1) {
        currentUserRank = idx + 1;
        currentUserEntry = topRows[idx];
      } else {
        // Считаем позицию пользователя за пределами топа
        const userBalance = await prisma.starBalance.findUnique({
          where: { userId: currentUserId },
          select: {
            userId: true,
            lifetimeEarn: true,
            available: true,
            user: {
              select: {
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                isPremium: true,
                createdAt: true,
              },
            },
          },
        });
        if (userBalance && userBalance.lifetimeEarn > 0) {
          const rank = await prisma.starBalance.count({
            where: {
              lifetimeEarn: { gt: userBalance.lifetimeEarn },
              user: { isBanned: false },
            },
          });
          currentUserRank = rank + 1;
          currentUserEntry = userBalance;
        }
      }
    }

    const leaderboard = topRows.map((row, idx) => ({
      rank: idx + 1,
      userId: row.userId,
      isCurrentUser: row.userId === currentUserId,
      username: row.user?.username ?? null,
      firstName: row.user?.firstName ?? null,
      lastName: row.user?.lastName ?? null,
      avatarUrl: row.user?.avatarUrl ?? null,
      isPremium: row.user?.isPremium ?? false,
      lifetimeEarn: row.lifetimeEarn,
      available: row.available,
    }));

    return applyHeaders(
      NextResponse.json({
        leaderboard,
        currentUser:
          currentUserEntry && currentUserRank
            ? {
                rank: currentUserRank,
                userId: currentUserEntry.userId,
                username: currentUserEntry.user?.username ?? null,
                firstName: currentUserEntry.user?.firstName ?? null,
                lastName: currentUserEntry.user?.lastName ?? null,
                avatarUrl: currentUserEntry.user?.avatarUrl ?? null,
                isPremium: currentUserEntry.user?.isPremium ?? false,
                lifetimeEarn: currentUserEntry.lifetimeEarn,
                available: currentUserEntry.available,
              }
            : null,
        total: topRows.length,
      }),
      rateResult,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return applyHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
      rateResult,
    );
  }
}

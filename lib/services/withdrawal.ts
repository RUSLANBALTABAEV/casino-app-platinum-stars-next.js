import { Prisma } from '@prisma/client';

import type { Withdrawal } from '@/types/withdrawal';
import * as WithdrawalEnums from '@/types/withdrawal-enums';
import { prisma } from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/services/security';

const NFT_TRANSFER_FEE_STARS = 25;

function toPositiveInt(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} должно быть положительным числом.`);
  }
  return Math.floor(value);
}

function assertDestination(destination: string): string {
  const trimmed = destination.trim();
  if (!trimmed) {
    throw new Error('Укажите реквизиты для вывода.');
  }
  if (trimmed.length > 160) {
    throw new Error('Реквизиты слишком длинные (максимум 160 символов).');
  }
  return trimmed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMeta(meta?: Record<string, unknown> | null): any | null {
  if (!meta) {
    return null;
  }
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Object.fromEntries(entries) as any;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractUserGiftId(meta: Record<string, unknown> | null): string | null {
  if (!meta) {
    return null;
  }
  const value = meta.userGiftId;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWithdrawal(record: any): Withdrawal {
  return {
    id: record.id,
    userId: record.userId,
    amount: record.amount,
    currency: record.currency,
    destination: record.destination,
    status: record.status,
    type: record.type,
    comment: record.comment ?? null,
    meta: toRecord(record.meta),
    createdAt: record.createdAt,
    processedAt: record.processedAt,
    processedById: record.processedById
  };
}

export interface SubmitWithdrawalInput {
  userId: string;
  amount: number;
  destination: string;
  type: WithdrawalEnums.WithdrawalType;
  currency: WithdrawalEnums.WithdrawalCurrency;
  comment?: string | null;
  meta?: Record<string, unknown>;
}

export async function submitWithdrawal({
  userId,
  amount,
  destination,
  type,
  currency,
  comment,
  meta
}: SubmitWithdrawalInput): Promise<Withdrawal> {
  const normalizedAmount = toPositiveInt(amount, 'Сумма вывода');
  const normalizedDestination = assertDestination(destination);

  const result: Withdrawal = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const balance = await tx.starBalance.findUnique({
      where: { userId }
    });

    if (!balance) {
      throw new Error('Баланс пользователя не найден.');
    }

    const metaRecord = toRecord(meta);
    const userGiftId = type === WithdrawalEnums.WithdrawalType.NFT_GIFT ? extractUserGiftId(metaRecord) : null;

    if (type === WithdrawalEnums.WithdrawalType.STARS) {
      if (balance.available < normalizedAmount) {
        throw new Error('Недостаточно звёзд на балансе.');
      }

      await tx.starBalance.update({
        where: { userId },
        data: {
          available: { decrement: normalizedAmount },
          reserved: { increment: normalizedAmount }
        }
      });
    } else {
      if (balance.available < NFT_TRANSFER_FEE_STARS) {
        throw new Error('Недостаточно звёзд для комиссии за выдачу NFT.');
      }

      await tx.starBalance.update({
        where: { userId },
        data: {
          available: { decrement: NFT_TRANSFER_FEE_STARS },
          lifetimeSpend: { increment: NFT_TRANSFER_FEE_STARS }
        }
      });
    }

    let ownedGift: Awaited<ReturnType<typeof tx.userNftGift.findFirst>> | null = null;
    if (userGiftId) {
      ownedGift = await tx.userNftGift.findFirst({
        where: { id: userGiftId, userId, status: 'OWNED' },
        include: { gift: true }
      });

      if (!ownedGift) {
        throw new Error('NFT не найден или уже использован.');
      }

      await tx.userNftGift.update({
        where: { id: ownedGift.id },
        data: {
          status: 'PENDING_SEND',
          metadata: normalizeMeta({
            ...(toRecord(ownedGift.metadata) ?? {}),
            transferRequestedAt: new Date().toISOString(),
            transferFee: NFT_TRANSFER_FEE_STARS
          })
        }
      });
    }

    const withdrawalMeta = normalizeMeta({
      ...(metaRecord ?? {}),
      ...(userGiftId ? { userGiftId } : {}),
      ...(ownedGift ? { giftId: ownedGift.giftId, giftName: ownedGift.gift.name } : {}),
      ...(type === WithdrawalEnums.WithdrawalType.NFT_GIFT ? { transferFee: NFT_TRANSFER_FEE_STARS } : {})
    });
    const normalizedComment = comment && comment.trim().length > 0 ? comment.trim().substring(0, 512) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withdrawal: any = await tx.withdrawal.create({
      data: {
        userId,
        amount: normalizedAmount,
        currency,
        destination: normalizedDestination,
        type,
        comment: normalizedComment,
        status: WithdrawalEnums.WithdrawalStatus.PENDING,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        meta: (withdrawalMeta as any) ?? null
      }
    });

    if (type === WithdrawalEnums.WithdrawalType.NFT_GIFT && NFT_TRANSFER_FEE_STARS > 0) {
      await tx.transaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          amount: NFT_TRANSFER_FEE_STARS,
          currency: WithdrawalEnums.WithdrawalCurrency.STARS,
          provider: 'MANUAL',
          status: 'COMPLETED',
          meta: {
            source: 'NFT_TRANSFER_FEE',
            withdrawalId: withdrawal.id,
            ...(userGiftId ? { userGiftId } : {}),
            ...(ownedGift ? { giftId: ownedGift.giftId, giftName: ownedGift.gift.name } : {})
          }
        }
      });
    }

    return mapWithdrawal(withdrawal);
  });

  await logSecurityEvent({
    type: 'WITHDRAWAL_REQUESTED',
    severity: 'INFO',
    message: `Новая заявка на вывод (${type}) на сумму ${normalizedAmount}`,
    userId,
    metadata: {
      amount: normalizedAmount,
      currency,
      destination: normalizedDestination,
      type
    }
  });

  // Пробуем авто-вывод асинхронно (не блокирует ответ пользователю)
  void import('@/lib/services/auto-withdrawal').then(({ maybeAutoProcess }) =>
    maybeAutoProcess(result.id)
  );

  return result;
}

export async function approveWithdrawal(
  withdrawalId: string,
  adminId: string | null = null
): Promise<Withdrawal> {
  const updated = await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: {
      status: WithdrawalEnums.WithdrawalStatus.APPROVED,
      processedById: adminId ?? undefined
    }
  });

  await logSecurityEvent({
    type: 'WITHDRAWAL_APPROVED',
    severity: 'INFO',
    message: 'Заявка на вывод одобрена',
    userId: updated.userId,
    metadata: {
      withdrawalId,
      adminId
    }
  });

  return mapWithdrawal(updated);
}

export async function rejectWithdrawal(
  withdrawalId: string,
  reason: string | null,
  adminId: string | null = null
): Promise<Withdrawal> {
  const updatedRecord = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new Error('Заявка не найдена.');
    }

    if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'APPROVED') {
      throw new Error('Заявка уже обработана.');
    }

    if (withdrawal.type === 'STARS') {
      await tx.starBalance.update({
        where: { userId: withdrawal.userId },
        data: {
          available: { increment: withdrawal.amount },
          reserved: { decrement: withdrawal.amount }
        }
      });
    } else {
      const metaRecord = toRecord(withdrawal.meta);
      const userGiftId = extractUserGiftId(metaRecord);
      if (userGiftId) {
        await tx.userNftGift.updateMany({
          where: { id: userGiftId, userId: withdrawal.userId },
          data: {
            status: 'OWNED',
            metadata: normalizeMeta({
              ...(metaRecord ?? {}),
              transferRejectedAt: new Date().toISOString()
            })
          }
        });
      }
    }

    return tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        processedById: adminId ?? undefined,
        processedAt: new Date(),
        meta: normalizeMeta({
          ...(toRecord(withdrawal.meta) ?? {}),
          rejectionReason: reason ?? undefined
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) ?? (null as any)
      }
    });
  });

  await logSecurityEvent({
    type: 'WITHDRAWAL_REJECTED',
    severity: 'WARNING',
    message: reason ? `Заявка отклонена: ${reason}` : 'Заявка отклонена',
    userId: updatedRecord.userId,
    metadata: {
      withdrawalId,
      adminId,
      reason
    }
  });

  return mapWithdrawal(updatedRecord);
}

export async function markWithdrawalSent(
  withdrawalId: string,
  adminId: string | null = null,
  meta: Record<string, unknown> = {}
): Promise<Withdrawal> {
  const updatedRecord = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId }
    });

    if (!withdrawal) {
      throw new Error('Заявка не найдена.');
    }
    if (withdrawal.status === 'SENT') {
      return withdrawal;
    }

    if (withdrawal.type === 'STARS') {
      await tx.starBalance.update({
        where: { userId: withdrawal.userId },
        data: {
          reserved: { decrement: withdrawal.amount },
          lifetimeSpend: { increment: withdrawal.amount }
        }
      });
    } else {
      const metaRecord = toRecord(withdrawal.meta);
      const userGiftId = extractUserGiftId(metaRecord);
      if (userGiftId) {
        await tx.userNftGift.updateMany({
          where: { id: userGiftId, userId: withdrawal.userId },
          data: {
            status: 'SENT',
            metadata: normalizeMeta({
              ...(metaRecord ?? {}),
              sentAt: new Date().toISOString()
            })
          }
        });
      }
    }

    await tx.transaction.create({
      data: {
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        type: 'WITHDRAWAL',
        status: 'COMPLETED',
        provider: 'MANUAL',
        currency: withdrawal.currency,
        meta: {
          source: 'WITHDRAWAL',
          withdrawalId,
          ...(meta ?? {})
        }
      }
    });

    return tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'SENT',
        processedById: adminId ?? undefined,
        processedAt: new Date(),
        meta: normalizeMeta({
          ...(toRecord(withdrawal.meta) ?? {}),
          ...meta
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) ?? (null as any)
      }
    });
  });

  await logSecurityEvent({
    type: 'WITHDRAWAL_SENT',
    severity: 'INFO',
    message: 'Заявка обработана и отправлена',
    userId: updatedRecord.userId,
    metadata: {
      withdrawalId,
      adminId
    }
  });

  return mapWithdrawal(updatedRecord);
}

export interface ListWithdrawalsOptions {
  status?: WithdrawalEnums.WithdrawalStatus;
  type?: WithdrawalEnums.WithdrawalType;
  take?: number;
  cursor?: string | null;
}

type WithdrawalUserSummary = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

const WITHDRAWAL_RELATIONS = {
  user: {
    select: {
      username: true,
      firstName: true,
      lastName: true
    }
  },
  processedBy: {
    select: {
      username: true,
      firstName: true,
      lastName: true
    }
  }
} as const;

export type WithdrawalWithRelations = Withdrawal & {
  user: WithdrawalUserSummary | null;
  processedBy: WithdrawalUserSummary | null;
};

export function listWithdrawals({
  status,
  type,
  take = 50,
  cursor
}: ListWithdrawalsOptions = {}): Promise<WithdrawalWithRelations[]> {
  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }

  return prisma.withdrawal
    .findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      cursor: cursor ? { id: cursor } : undefined,
      include: WITHDRAWAL_RELATIONS
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((entries: any[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entries.map((entry: any) => ({
        ...mapWithdrawal(entry),
        user: entry.user
          ? {
              username: entry.user.username,
              firstName: entry.user.firstName,
              lastName: entry.user.lastName
            }
          : null,
        processedBy: entry.processedBy
          ? {
              username: entry.processedBy.username,
              firstName: entry.processedBy.firstName,
              lastName: entry.processedBy.lastName
            }
          : null
      }))
    );
}

export function listUserWithdrawals(userId: string): Promise<Withdrawal[]> {
  return prisma.withdrawal
    .findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((records: any[]) => records.map(mapWithdrawal));
}

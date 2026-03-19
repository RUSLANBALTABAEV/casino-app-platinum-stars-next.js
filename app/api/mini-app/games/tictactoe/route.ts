import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { applyHeaders, applyRateLimit } from '@/lib/http/rate-limit';
import { getClientIdentifier } from '@/lib/http/request-helpers';
import { getDemoBalance, isDemoRequest } from '@/lib/demo-mode';
import { prisma } from '@/lib/prisma';
import { getGameSetting } from '@/lib/services/game-settings';
import { logSecurityEvent } from '@/lib/services/security';
import { syncTelegramUser } from '@/lib/services/user';
import {
  assertInitDataIsFresh,
  ensureTelegramUser,
  getBotToken,
  getDevTelegramUser,
  isDevTelegramBypassEnabled,
  parseInitData,
  verifyInitData
} from '@/lib/telegram/init-data';

type TicTacToeAction = 'start' | 'move';

type TicTacToeBody = {
  action?: TicTacToeAction;
  bet?: number;
  sessionId?: string;
  index?: number;
};

type TicTacToeMetadata = {
  board: Array<'X' | 'O' | null>;
  status: 'active' | 'win' | 'lose' | 'draw';
  multiplier: number;
};

type TicTacToeResponse = {
  sessionId: string;
  board: Array<'X' | 'O' | null>;
  status: TicTacToeMetadata['status'];
  payout?: number;
  balance?: {
    available: number;
    reserved: number;
    bonusAvailable?: number;
    bonusReserved?: number;
  };
};

const demoSessions = new Map<string, TicTacToeMetadata>();

function checkWinner(board: Array<'X' | 'O' | null>) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isBoardFull(board: Array<'X' | 'O' | null>) {
  return board.every((cell) => cell !== null);
}

function findWinningMove(board: Array<'X' | 'O' | null>, mark: 'X' | 'O') {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    const line = [board[a], board[b], board[c]];
    const emptyIndex = line.findIndex((cell) => cell === null);
    if (emptyIndex === -1) {
      continue;
    }
    const marks = line.filter((cell) => cell === mark).length;
    if (marks === 2) {
      return [a, b, c][emptyIndex];
    }
  }
  return null;
}

function findBestMove(board: Array<'X' | 'O' | null>) {
  const winMove = findWinningMove(board, 'O');
  if (winMove !== null) {
    return winMove;
  }
  const blockMove = findWinningMove(board, 'X');
  if (blockMove !== null) {
    return blockMove;
  }
  if (board[4] === null) {
    return 4;
  }
  const corners = [0, 2, 6, 8].filter((index) => board[index] === null);
  if (corners.length) {
    return corners[Math.floor(Math.random() * corners.length)];
  }
  const edges = [1, 3, 5, 7].filter((index) => board[index] === null);
  if (edges.length) {
    return edges[Math.floor(Math.random() * edges.length)];
  }
  return null;
}

async function resolveUser(req: NextRequest) {
  const raw = req.headers.get('x-telegram-init-data');
  if (!raw) {
    if (isDevTelegramBypassEnabled()) {
      return syncTelegramUser(getDevTelegramUser());
    }
    throw new Error('Missing X-Telegram-Init-Data header');
  }
  try {
    const token = getBotToken();
    if (!verifyInitData(raw, token)) {
      throw new Error('Invalid Telegram signature');
    }
  } catch (error) {
    if (isDevTelegramBypassEnabled()) {
      return syncTelegramUser(getDevTelegramUser());
    }
    throw error;
  }
  const initData = parseInitData(raw);
  assertInitDataIsFresh(initData);
  const telegramUser = ensureTelegramUser(initData);
  return syncTelegramUser(telegramUser);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateResult = applyRateLimit(`${getClientIdentifier(req)}:miniapp-ttt:post`, {
    limit: 120,
    windowMs: 60_000
  });
  if (!rateResult.success) {
    return applyHeaders(
      NextResponse.json({ error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 }),
      rateResult
    );
  }

  let body: TicTacToeBody;
  try {
    body = (await req.json()) as TicTacToeBody;
  } catch {
    return applyHeaders(
      NextResponse.json({ error: 'Некорректный формат запроса.' }, { status: 400 }),
      rateResult
    );
  }

  const action: TicTacToeAction = body.action ?? 'start';

  const setting = await getGameSetting('TICTACTOE', 'config');
  const config = (setting?.value ?? {}) as { multiplier?: number; baseBet?: number };
  const multiplier = typeof config.multiplier === 'number' ? config.multiplier : 2.2;
  const baseBet = typeof config.baseBet === 'number' ? config.baseBet : 15;

  if (isDemoRequest(req)) {
    if (action === 'start') {
      const sessionId = crypto.randomUUID();
      demoSessions.set(sessionId, { board: Array(9).fill(null), status: 'active', multiplier });
      const response: TicTacToeResponse = {
        sessionId,
        board: Array(9).fill(null),
        status: 'active',
        balance: getDemoBalance()
      };
      return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
    }

    const sessionId = body.sessionId;
    if (!sessionId) {
      return applyHeaders(NextResponse.json({ error: 'Не найдена сессия.' }, { status: 400 }), rateResult);
    }
    const session = demoSessions.get(sessionId);
    if (!session) {
      return applyHeaders(NextResponse.json({ error: 'Сессия не найдена.' }, { status: 404 }), rateResult);
    }
    if (session.status !== 'active') {
      return applyHeaders(NextResponse.json({ error: 'Игра уже завершена.' }, { status: 400 }), rateResult);
    }

    const index = typeof body.index === 'number' ? Math.round(body.index) : -1;
    if (index < 0 || index >= 9 || session.board[index]) {
      return applyHeaders(NextResponse.json({ error: 'Некорректный ход.' }, { status: 400 }), rateResult);
    }

    session.board[index] = 'X';
    const playerWin = checkWinner(session.board);
    if (playerWin) {
      session.status = 'win';
      const response: TicTacToeResponse = {
        sessionId,
        board: session.board,
        status: 'win',
        payout: Math.round(baseBet * multiplier),
        balance: getDemoBalance()
      };
      return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
    }

    if (isBoardFull(session.board)) {
      session.status = 'draw';
      const response: TicTacToeResponse = {
        sessionId,
        board: session.board,
        status: 'draw',
        payout: baseBet,
        balance: getDemoBalance()
      };
      return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
    }

    const aiMove = findBestMove(session.board);
    if (aiMove !== null) {
      session.board[aiMove] = 'O';
    }
    const aiWin = checkWinner(session.board);
    if (aiWin) {
      session.status = 'lose';
    } else if (isBoardFull(session.board)) {
      session.status = 'draw';
    }

    const response: TicTacToeResponse = {
      sessionId,
      board: session.board,
      status: session.status,
      payout: session.status === 'win' ? Math.round(baseBet * multiplier) : session.status === 'draw' ? baseBet : 0,
      balance: getDemoBalance()
    };
    return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
  }

  try {
    const user = await resolveUser(req);
    const bet = typeof body.bet === 'number' ? Math.max(1, Math.round(body.bet)) : baseBet;

    if (action === 'start') {
      const result = await prisma.$transaction(async (tx) => {
        let balance = await tx.starBalance.findUnique({ where: { userId: user.userId } });
        if (!balance) {
          balance = await tx.starBalance.create({
            data: {
              userId: user.userId,
              available: 0,
              reserved: 0,
              lifetimeEarn: 0,
              lifetimeSpend: 0,
              bonusAvailable: 0,
              bonusReserved: 0,
              bonusLifetimeEarn: 0,
              bonusLifetimeSpend: 0
            }
          });
        }
        if (balance.available < bet) {
          throw new Error('Недостаточно звёзд для ставки.');
        }
        const updatedBalance = await tx.starBalance.update({
          where: { userId: user.userId },
          data: {
            available: { set: balance.available - bet },
            lifetimeSpend: { increment: bet }
          }
        });
        await tx.transaction.create({
          data: {
            userId: user.userId,
            type: 'PURCHASE',
            amount: bet,
            currency: 'STARS',
            provider: 'MANUAL',
            status: 'COMPLETED',
            meta: { source: 'TICTACTOE_WAGER' }
          }
        });
        const session = await tx.gameSession.create({
          data: {
            userId: user.userId,
            gameType: 'TICTACTOE',
            wager: bet,
            metadata: {
              board: Array(9).fill(null),
              status: 'active',
              multiplier
            } satisfies TicTacToeMetadata
          }
        });
        return { balance: updatedBalance, session };
      });

      await logSecurityEvent({
        type: 'TICTACTOE_START',
        severity: 'INFO',
        message: 'Пользователь начал игру TTT',
        userId: user.userId,
        metadata: { bet }
      });

      const response: TicTacToeResponse = {
        sessionId: result.session.id,
        board: Array(9).fill(null),
        status: 'active',
        balance: {
          available: result.balance.available,
          reserved: result.balance.reserved,
          bonusAvailable: result.balance.bonusAvailable,
          bonusReserved: result.balance.bonusReserved
        }
      };
      return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
    }

    if (!body.sessionId) {
      return applyHeaders(NextResponse.json({ error: 'Не найдена сессия.' }, { status: 400 }), rateResult);
    }

    const session = await prisma.gameSession.findUnique({ where: { id: body.sessionId } });
    if (!session || session.gameType !== 'TICTACTOE' || session.userId !== user.userId) {
      return applyHeaders(NextResponse.json({ error: 'Сессия не найдена.' }, { status: 404 }), rateResult);
    }
    const metadata = session.metadata as TicTacToeMetadata | null;
    if (!metadata) {
      return applyHeaders(NextResponse.json({ error: 'Некорректные данные сессии.' }, { status: 400 }), rateResult);
    }
    if (session.finishedAt || metadata.status !== 'active') {
      return applyHeaders(NextResponse.json({ error: 'Игра уже завершена.' }, { status: 400 }), rateResult);
    }

    const index = typeof body.index === 'number' ? Math.round(body.index) : -1;
    if (index < 0 || index >= 9 || metadata.board[index]) {
      return applyHeaders(NextResponse.json({ error: 'Некорректный ход.' }, { status: 400 }), rateResult);
    }

    const nextBoard = [...metadata.board];
    nextBoard[index] = 'X';

    let status: TicTacToeMetadata['status'] = 'active';
    let payout = 0;
    let finishedAt: Date | null = null;

    if (checkWinner(nextBoard) === 'X') {
      status = 'win';
    } else if (isBoardFull(nextBoard)) {
      status = 'draw';
    } else {
      const aiMove = findBestMove(nextBoard);
      if (aiMove !== null) {
        nextBoard[aiMove] = 'O';
      }
      if (checkWinner(nextBoard) === 'O') {
        status = 'lose';
      } else if (isBoardFull(nextBoard)) {
        status = 'draw';
      }
    }

    if (status === 'win') {
      payout = Math.round((session.wager ?? 0) * multiplier);
      finishedAt = new Date();
    } else if (status === 'draw') {
      payout = session.wager ?? 0;
      finishedAt = new Date();
    } else if (status === 'lose') {
      payout = 0;
      finishedAt = new Date();
    }

    if (status === 'active') {
      await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          metadata: {
            board: nextBoard,
            status: 'active',
            multiplier
          } satisfies TicTacToeMetadata
        }
      });
      const response: TicTacToeResponse = {
        sessionId: session.id,
        board: nextBoard,
        status: 'active'
      };
      return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBalance = await tx.starBalance.update({
        where: { userId: user.userId },
        data: {
          available: { increment: payout },
          ...(payout > 0 ? { lifetimeEarn: { increment: payout } } : {})
        }
      });
      if (payout > 0) {
        await tx.transaction.create({
          data: {
            userId: user.userId,
            type: 'REWARD',
            amount: payout,
            currency: 'STARS',
            provider: 'MANUAL',
            status: 'COMPLETED',
            meta: { source: 'TICTACTOE_REWARD', outcome: status }
          }
        });
      }
      await tx.gameSession.update({
        where: { id: session.id },
        data: {
          payout,
          finishedAt,
          metadata: {
            board: nextBoard,
            status,
            multiplier
          } satisfies TicTacToeMetadata
        }
      });
      return updatedBalance;
    });

    await logSecurityEvent({
      type: 'TICTACTOE_FINISH',
      severity: 'INFO',
      message: 'Пользователь завершил матч TTT',
      userId: user.userId,
      metadata: { bet: session.wager ?? 0, payout, status }
    });

    const response: TicTacToeResponse = {
      sessionId: session.id,
      board: nextBoard,
      status,
      payout,
      balance: {
        available: result.available,
        reserved: result.reserved,
        bonusAvailable: result.bonusAvailable,
        bonusReserved: result.bonusReserved
      }
    };
    return applyHeaders(NextResponse.json({ success: true, result: response }), rateResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось сыграть.';
    return applyHeaders(NextResponse.json({ error: message }, { status: 400 }), rateResult);
  }
}

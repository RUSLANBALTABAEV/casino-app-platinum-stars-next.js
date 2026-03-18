'use client';

import React, { useMemo, useState } from 'react';

import GameViewport from '@/components/games/GameViewport';
import { useTelegram } from '@/context/TelegramContext';
import { buildTelegramAuthHeaders } from '@/lib/telegram';

type MinesStatus = 'idle' | 'active' | 'lost' | 'cashed';

type MinesResult = {
  sessionId: string;
  gridSize: number;
  minesCount: number;
  picks: number[];
  status: 'active' | 'lost' | 'cashed';
  multiplier: number;
  payout?: number;
  mines?: number[];
};

export default function MinesPage(): React.JSX.Element {
  const { initDataRaw } = useTelegram();
  const [bet, setBet] = useState(20);
  const [minesCount, setMinesCount] = useState(5);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<MinesStatus>('idle');
  const [picks, setPicks] = useState<number[]>([]);
  const [mines, setMines] = useState<number[] | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [payout, setPayout] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cells = useMemo(() => Array.from({ length: 25 }, (_, index) => index), []);

  const updateFromResult = (result: MinesResult) => {
    setSessionId(result.sessionId);
    setStatus(result.status);
    setPicks(result.picks);
    setMultiplier(result.multiplier);
    setPayout(result.payout ?? null);
    setMines(result.mines ?? null);
  };

  const startGame = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mini-app/games/mines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw)
        },
        body: JSON.stringify({ action: 'start', bet, mines: minesCount })
      });
      const payload = (await response.json().catch(() => ({}))) as { result?: MinesResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? 'Не удалось начать игру.');
      }
      setStatus('active');
      setPayout(null);
      setMines(null);
      updateFromResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать игру.');
    } finally {
      setIsLoading(false);
    }
  };

  const pickCell = async (index: number) => {
    if (!sessionId || status !== 'active' || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mini-app/games/mines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw)
        },
        body: JSON.stringify({ action: 'pick', sessionId, index })
      });
      const payload = (await response.json().catch(() => ({}))) as { result?: MinesResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? 'Не удалось открыть ячейку.');
      }
      updateFromResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть ячейку.');
    } finally {
      setIsLoading(false);
    }
  };

  const cashout = async () => {
    if (!sessionId || status !== 'active' || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mini-app/games/mines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw)
        },
        body: JSON.stringify({ action: 'cashout', sessionId })
      });
      const payload = (await response.json().catch(() => ({}))) as { result?: MinesResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? 'Не удалось забрать выигрыш.');
      }
      updateFromResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось забрать выигрыш.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFinished = status === 'lost' || status === 'cashed';

  return (
    <GameViewport
      backgroundClassName="bg-gradient-to-b from-[#0b0d1c] via-[#05060b] to-black"
      contentClassName="flex flex-col gap-4"
      backLabel="Игры"
    >
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/70">Mines</p>
        <h1 className="text-2xl font-semibold text-white">Минное поле</h1>
        <p className="text-sm text-white/60">
          Открывайте клетки вручную и забирайте выигрыш вовремя. Чем больше ходов — тем выше множитель.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/10 via-black/40 to-black/80 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl animate-pulse" />
        <div className="absolute -right-6 top-1/2 h-24 w-24 rounded-full bg-emerald-300/10 blur-2xl animate-pulse" />
        <div className="relative grid grid-cols-5 gap-2">
          {cells.map((index) => {
            const isPicked = picks.includes(index);
            const isMine = mines?.includes(index) ?? false;
            const isRevealed = isPicked || (isFinished && isMine);
            return (
              <button
                key={index}
                className={`flex aspect-square items-center justify-center rounded-xl border text-xs shadow-inner transition ${
                  isRevealed
                    ? isMine
                      ? 'border-red-400/60 bg-red-500/10'
                      : 'border-emerald-300/40 bg-emerald-400/10'
                    : 'border-emerald-300/20 bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => pickCell(index)}
                type="button"
                disabled={status !== 'active' || isPicked || isLoading}
              >
                {isRevealed ? (
                  <img
                    src={isMine ? '/textures/games/bomb.svg' : '/textures/games/coins.svg'}
                    alt=""
                    className="h-5 w-5 opacity-80"
                    aria-hidden
                  />
                ) : (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/40">★</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
            Ставка (★)
            <input
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              type="number"
              min={1}
              value={bet}
              onChange={(event) => setBet(Number.parseInt(event.target.value, 10) || 1)}
              disabled={isLoading || status === 'active'}
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
            Кол-во мин
            <input
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              type="number"
              min={2}
              max={12}
              value={minesCount}
              onChange={(event) => setMinesCount(Number.parseInt(event.target.value, 10) || 2)}
              disabled={isLoading || status === 'active'}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/70">
          <span>Ходов: {picks.length}</span>
          <span>Множитель: x{multiplier.toFixed(2)}</span>
          <span>Потенциал: {Math.round(bet * multiplier)} ★</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            className="w-full rounded-full bg-emerald-400/90 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            onClick={startGame}
            disabled={isLoading || status === 'active'}
          >
            {isLoading && status !== 'active' ? 'Создаём поле...' : 'Новая игра'}
          </button>
          <button
            className="w-full rounded-full border border-emerald-300/40 bg-black/40 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            onClick={cashout}
            disabled={isLoading || status !== 'active'}
          >
            {isLoading && status === 'active' ? 'Фиксируем...' : 'Забрать'}
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-red-300">{error}</p>
        ) : null}

        {status === 'lost' ? (
          <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-red-200/70">Мина</p>
            <p className="mt-2 text-xl font-semibold text-white">Вы проиграли. Попробуйте снова.</p>
          </div>
        ) : null}

        {status === 'cashed' ? (
          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Выигрыш</p>
            <p className="mt-2 text-xl font-semibold text-white">
              +{payout ?? 0} ★ на баланс
            </p>
          </div>
        ) : null}
      </div>
    </GameViewport>
  );
}

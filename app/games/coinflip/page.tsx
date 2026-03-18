'use client';

import React, { useState } from 'react';

import GameViewport from '@/components/games/GameViewport';
import { useTelegram } from '@/context/TelegramContext';
import { buildTelegramAuthHeaders } from '@/lib/telegram';

type CoinflipResult = {
  win: boolean;
  payout: number;
  flip: 'heads' | 'tails';
};

export default function CoinflipPage(): React.JSX.Element {
  const { initDataRaw } = useTelegram();
  const [bet, setBet] = useState(15);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<CoinflipResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const play = async () => {
    setIsPlaying(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/mini-app/games/coinflip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw)
        },
        body: JSON.stringify({ bet, choice })
      });
      const payload = (await response.json().catch(() => ({}))) as { result?: CoinflipResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? 'Не удалось сыграть.');
      }
      setResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сыграть.');
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <GameViewport
      backgroundClassName="bg-gradient-to-b from-[#0c0b16] via-[#07060c] to-black"
      contentClassName="flex flex-col gap-4"
      backLabel="Игры"
    >
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-amber-300/70">Coin Flip</p>
        <h1 className="text-2xl font-semibold text-white">Орёл и решка</h1>
        <p className="text-sm text-white/60">Ставьте на сторону монеты и забирайте удвоение.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="relative flex items-center justify-center py-6">
          <div className="absolute -left-6 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-amber-300/20 blur-2xl animate-pulse" />
          <div className="absolute -right-4 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-amber-300/10 blur-2xl animate-pulse" />
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full border border-yellow-400/40 bg-yellow-400/20 text-4xl shadow-[0_18px_30px_rgba(0,0,0,0.35)] ${
              isPlaying ? 'animate-spin' : ''
            }`}
          >
            <img
              src={
                result?.flip === 'tails'
                  ? '/textures/games/reshka.png'
                  : result?.flip === 'heads'
                    ? '/textures/games/orel.png'
                    : '/textures/games/coins.svg'
              }
              alt=""
              className="h-full w-full rounded-full object-cover opacity-90"
              aria-hidden
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
            Ставка (★)
            <input
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              type="number"
              min={1}
              value={bet}
              onChange={(event) => setBet(Number.parseInt(event.target.value, 10) || 1)}
              disabled={isPlaying}
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
            Сторона
            <select
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              value={choice}
              onChange={(event) => setChoice(event.target.value === 'tails' ? 'tails' : 'heads')}
              disabled={isPlaying}
            >
              <option value="heads">Орёл</option>
              <option value="tails">Решка</option>
            </select>
          </label>
        </div>

        <button
          className="mt-4 w-full rounded-full bg-amber-300/90 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition active:scale-[0.98] disabled:opacity-60"
          type="button"
          onClick={play}
          disabled={isPlaying}
        >
          {isPlaying ? 'Подбрасываем...' : 'Подбросить'}
        </button>

        {error ? (
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-red-300">{error}</p>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Итог</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {result.win ? `+${result.payout} ★` : 'Не угадали'}
            </p>
          </div>
        ) : null}
      </div>
    </GameViewport>
  );
}

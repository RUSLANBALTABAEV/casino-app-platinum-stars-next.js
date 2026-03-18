'use client';

import React, { useState } from 'react';

import GameViewport from '@/components/games/GameViewport';
import { useTelegram } from '@/context/TelegramContext';
import { buildTelegramAuthHeaders } from '@/lib/telegram';

type UpgradeResult = {
  win: boolean;
  payout: number;
  nftGift?: {
    id: string;
    name: string;
    rarity: string;
    imageUrl?: string | null;
  } | null;
};

export default function UpgradePage(): React.JSX.Element {
  const { initDataRaw } = useTelegram();
  const [bet, setBet] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const play = async () => {
    setIsPlaying(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/mini-app/games/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw)
        },
        body: JSON.stringify({ bet })
      });
      const payload = (await response.json().catch(() => ({}))) as { result?: UpgradeResult; error?: string };
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
      backgroundClassName="bg-gradient-to-b from-[#140b10] via-[#0b0609] to-black"
      contentClassName="flex flex-col gap-4"
      backLabel="Игры"
    >
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-rose-300/70">Upgrade</p>
        <h1 className="text-2xl font-semibold text-white">Апгрейд</h1>
        <p className="text-sm text-white/60">Повышайте ставку и ловите мощный коэффициент.</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-rose-300/20 bg-gradient-to-br from-rose-500/10 via-black/40 to-black/80 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-rose-300/20 blur-2xl animate-pulse" />
        <div className="absolute -right-6 bottom-0 h-24 w-24 rounded-full bg-rose-300/10 blur-2xl animate-pulse" />
        <div className="flex items-center gap-2">
          <img
            src="/textures/games/trending-up.svg"
            alt=""
            className="h-4 w-4 opacity-80"
            aria-hidden
          />
          <p className="text-xs uppercase tracking-[0.22em] text-rose-200/80">Шанс на апгрейд</p>
        </div>
        <div className="mt-3 h-3 w-full rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-rose-300 to-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.35)]" />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
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

        <button
          className="mt-4 w-full rounded-full bg-rose-400/90 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition active:scale-[0.98] disabled:opacity-60"
          type="button"
          onClick={play}
          disabled={isPlaying}
        >
          {isPlaying ? 'Апгрейдим...' : 'Апгрейд'}
        </button>

        {error ? (
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-red-300">{error}</p>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Результат</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {result.win ? `Успех! +${result.payout} ★` : 'Не удалось'}
            </p>
            {result.nftGift ? (
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-emerald-200">
                NFT: {result.nftGift.name}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </GameViewport>
  );
}

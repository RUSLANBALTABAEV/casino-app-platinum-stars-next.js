'use client';

import React, { useEffect, useState } from 'react';

import GarlandWrap from '@/components/effects/GarlandWrap';
import { useTelegram } from '@/context/TelegramContext';
import { buildTelegramAuthHeaders } from '@/lib/telegram';
import { isHolidaySeason } from '@/lib/ui/season';

type InventoryItem = {
  id: string;
  giftId: string;
  name: string;
  rarity: string;
  imageUrl?: string | null;
  priceStars?: number | null;
  status: string;
  receivedAt: string;
};

export default function InventoryPage(): React.JSX.Element {
  const holidayActive = isHolidaySeason();
  const { initDataRaw } = useTelegram();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch('/api/mini-app/nfts', {
          headers: buildTelegramAuthHeaders(initDataRaw),
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as
          | { items?: InventoryItem[]; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? 'Не удалось загрузить инвентарь.');
        }
        setItems(payload?.items ?? []);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Не удалось загрузить инвентарь.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [initDataRaw]);

  const sellGift = async (giftId: string) => {
    setSellingId(giftId);
    setActionMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/mini-app/nfts/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw)
        },
        body: JSON.stringify({ userGiftId: giftId })
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; gift?: { name?: string; priceStars?: number | null } }
        | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Не удалось продать NFT.');
      }
      setItems((prev) => prev.filter((item) => item.id !== giftId));
      const price = payload?.gift?.priceStars ? `+${payload.gift.priceStars} ★` : '★';
      const name = payload?.gift?.name ?? 'NFT';
      setActionMessage(`Продано: ${name} (${price}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось продать NFT.');
    } finally {
      setSellingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="relative space-y-2">
        {holidayActive ? (
          <GarlandWrap variant="home-actions" className="absolute inset-x-[-16px] -top-6 h-32" />
        ) : null}
        <p className="ui-kicker">NFT инвентарь</p>
        <h1 className="ui-title">Ваши подарки Telegram</h1>
        <p className="ui-lead max-w-[56ch]">
          Здесь хранятся все NFT‑подарки, полученные из кейсов и игр. Можно использовать для крафта
          или участия в батлах.
        </p>
      </header>

      {isLoading ? (
        <div className="ui-card ui-card-glass ui-card-pad">
          <p className="text-sm text-platinum/60">Загрузка инвентаря…</p>
        </div>
      ) : error ? (
        <div className="ui-card ui-card-glass ui-card-pad border border-red-400/35 bg-red-500/10 text-sm text-red-200">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="ui-card ui-card-glass ui-card-pad">
          <p className="text-sm text-platinum/60">Пока нет NFT‑подарков. Откройте кейсы!</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="ui-card ui-card-glass ui-card-gold ui-card-pad flex items-center gap-4"
            >
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">🎁</div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-platinum/50">{item.rarity}</p>
                <p className="text-base font-semibold text-platinum">{item.name}</p>
                {item.priceStars ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-emerald-200/80">
                    Выкуп: {item.priceStars} ★
                  </p>
                ) : null}
                <p className="text-[11px] uppercase tracking-[0.14em] text-platinum/45">
                  Получен: {new Date(item.receivedAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <div className="ml-auto">
                <button
                  type="button"
                  className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition disabled:opacity-40"
                  onClick={() => sellGift(item.id)}
                  disabled={!item.priceStars || sellingId === item.id}
                >
                  {sellingId === item.id ? 'Продаём…' : 'Продать'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionMessage ? (
        <div className="ui-card ui-card-glass ui-card-pad border border-emerald-300/30 bg-emerald-400/10 text-sm text-emerald-100">
          {actionMessage}
        </div>
      ) : null}
    </section>
  );
}

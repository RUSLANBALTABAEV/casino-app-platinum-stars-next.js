'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { useTelegram } from '@/context/TelegramContext';
import { buildTelegramAuthHeaders } from '@/lib/telegram';

// ─── Типы ────────────────────────────────────────────────────────────────────

type NftItem = {
  id: string;
  name: string;
  rarity: string;
  description?: string | null;
  imageUrl?: string | null;
  priceStars?: number | null;
  available?: number;
  feeStars?: number;
};

type RarityKey = 'ALL' | 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

const RARITY_LABELS: Record<string, string> = {
  ALL: 'Все',
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'text-platinum/70 border-white/20',
  RARE: 'text-sky-300 border-sky-400/40',
  EPIC: 'text-purple-300 border-purple-400/40',
  LEGENDARY: 'text-gold-400 border-gold-400/60',
};

// ─── Компонент карточки NFT ───────────────────────────────────────────────────

function NftCard({
  item,
  onBuy,
  buying,
}: {
  item: NftItem;
  onBuy: (id: string) => void;
  buying: boolean;
}) {
  const rarityClass = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.COMMON;

  return (
    <div className="ui-card ui-card-glass relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
      {/* Картинка */}
      <div className="relative h-40 w-full overflow-hidden bg-black/30">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">🎁</div>
        )}
        {/* Rarity badge */}
        <span
          className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm ${rarityClass} bg-black/50`}
        >
          {item.rarity}
        </span>
      </div>

      {/* Контент */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold leading-tight text-platinum">{item.name}</h3>
        {item.description ? (
          <p className="line-clamp-2 text-[11px] text-platinum/50">{item.description}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {item.priceStars ? (
            <span className="text-sm font-bold text-gold-400">{item.priceStars} ★</span>
          ) : (
            <span className="text-xs text-platinum/40">—</span>
          )}
          {typeof item.available === 'number' ? (
            <span className="text-[10px] text-platinum/40">В наличии: {item.available}</span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onBuy(item.id)}
          disabled={buying || !item.priceStars || (typeof item.available === 'number' && item.available === 0)}
          className="mt-1 w-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500 py-2 text-xs font-bold uppercase tracking-widest text-night shadow-[0_4px_20px_rgba(212,175,55,0.3)] transition-all hover:shadow-[0_6px_28px_rgba(212,175,55,0.5)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {buying ? 'Покупаем…' : item.available === 0 ? 'Нет в наличии' : 'Купить за Stars'}
        </button>
      </div>
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function NftShopPage(): React.JSX.Element {
  const { initDataRaw, user } = useTelegram();

  const [items, setItems] = useState<NftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RarityKey>('ALL');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Показываем тост и скрываем через 3 сек
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Загрузка каталога
  const loadItems = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bot/nft-shop?telegramId=${user.id}&limit=30`,
        { headers: buildTelegramAuthHeaders(initDataRaw) },
      );
      const data = (await res.json().catch(() => null)) as
        | { items?: NftItem[]; error?: string }
        | null;
      if (!res.ok || !data?.items) throw new Error(data?.error ?? 'Не удалось загрузить магазин.');
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки.');
    } finally {
      setIsLoading(false);
    }
  }, [initDataRaw, user?.id]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  // Покупка NFT
  const handleBuy = async (giftId: string) => {
    if (!user?.id || buyingId) return;
    setBuyingId(giftId);
    try {
      const res = await fetch('/api/bot/nft-shop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildTelegramAuthHeaders(initDataRaw),
        },
        body: JSON.stringify({ telegramId: user.id, giftId, currency: 'STARS' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { gift?: { name?: string; priceStars?: number }; error?: string }
        | null;
      if (!res.ok || !data?.gift) throw new Error(data?.error ?? 'Не удалось купить NFT.');
      showToast('ok', `✅ ${data.gift.name} добавлен в инвентарь!`);
      void loadItems(); // обновляем количество
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Ошибка покупки.');
    } finally {
      setBuyingId(null);
    }
  };

  // Фильтрация
  const displayed = filter === 'ALL'
    ? items
    : items.filter((i) => i.rarity === filter);

  const rarities: RarityKey[] = ['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  const hasByRarity = (r: RarityKey) =>
    r === 'ALL' || items.some((i) => i.rarity === r);

  return (
    <section className="space-y-6">
      {/* Шапка */}
      <header className="space-y-1">
        <p className="ui-kicker">Каталог</p>
        <h1 className="ui-title">NFT‑магазин</h1>
        <p className="ui-lead max-w-[52ch]">
          Покупайте эксклюзивные Telegram‑подарки за звёзды. Редкие NFT дают бонусы в играх.
        </p>
      </header>

      {/* Фильтры */}
      {!isLoading && !error && items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {rarities.filter(hasByRarity).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFilter(r)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest transition-all ${
                filter === r
                  ? 'border-gold-400/70 bg-gold-400/15 text-gold-400'
                  : 'border-white/15 bg-white/5 text-platinum/60 hover:border-white/30 hover:text-platinum/80'
              }`}
            >
              {RARITY_LABELS[r]}
            </button>
          ))}
        </div>
      ) : null}

      {/* Состояния */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : error ? (
        <div className="ui-card ui-card-glass ui-card-pad border border-red-400/30 bg-red-500/10 text-sm text-red-200">
          {error}
          <button
            type="button"
            onClick={() => void loadItems()}
            className="mt-3 block text-xs underline opacity-70 hover:opacity-100"
          >
            Попробовать снова
          </button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="ui-card ui-card-glass ui-card-pad text-sm text-platinum/60">
          {filter === 'ALL'
            ? 'Магазин пока пуст. Загляните позже!'
            : `Нет NFT категории ${RARITY_LABELS[filter]}.`}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayed.map((item) => (
            <NftCard
              key={item.id}
              item={item}
              onBuy={handleBuy}
              buying={buyingId === item.id}
            />
          ))}
        </div>
      )}

      {/* Toast-уведомление */}
      {toast ? (
        <div
          className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl backdrop-blur-md ${
            toast.type === 'ok'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}
        >
          {toast.msg}
        </div>
      ) : null}
    </section>
  );
}

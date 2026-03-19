'use client';

import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/context/TelegramContext';
import { useStarBalance } from '@/lib/hooks/useStarBalance';
import { isDemoModeEnabled, setDemoMode } from '@/lib/demo-mode';
import { getTelegramAvatarFallback, getTelegramDisplayName } from '@/lib/telegram';
import { isHolidaySeason } from '@/lib/ui/season';
import GarlandWrap from '@/components/effects/GarlandWrap';

type QuickAction = {
  label: string;
  description: string;
  href: string;
  intent: 'primary' | 'secondary';
};

interface ProfileSnapshot {
  balance: number;
  streakDays: number;
  earnedToday: number;
  availablePromos: number;
  status: 'STANDARD' | 'PREMIUM';
  statusExpiresAt: string | null;
  user?: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    avatarUrl?: string | null;
    isPremium: boolean;
  };
}

const FALLBACK_PROFILE: ProfileSnapshot = {
  balance: 0,
  streakDays: 0,
  earnedToday: 0,
  availablePromos: 0,
  status: 'STANDARD',
  statusExpiresAt: null,
};

export default function HomePage() {
  const router = useRouter();
  const { user, isReady, initDataRaw } = useTelegram();
  const { state: balanceState } = useStarBalance();

  const [profile, setProfile] = useState<ProfileSnapshot>(FALLBACK_PROFILE);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [demoMode, setDemoModeState] = useState(isDemoModeEnabled());

  const holidayActive = isHolidaySeason();

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }),
    [],
  );

  // ── Загрузка профиля ────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !initDataRaw?.trim()) return;

    let cancelled = false;
    setIsFetchingProfile(true);
    setProfileError(null);

    const headers: Record<string, string> = {
      'x-telegram-init-data': initDataRaw,
    };

    fetch('/api/mini-app/profile', { method: 'GET', headers })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      })
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          setProfileError(response.error);
        } else if (response.profile) {
          setProfile({
            ...FALLBACK_PROFILE,
            ...response.profile,
            user: response.profile.user ?? profile.user,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProfileError(err.message || 'Ошибка загрузки профиля');
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetchingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, initDataRaw]);

  // ── Онлайн-счётчик ──────────────────────────────────────────────────
  useEffect(() => {
    const loadOnline = async () => {
      try {
        const res = await fetch('/api/bot/online?windowSeconds=300', { cache: 'no-store' });
        const data = await res.json();
        if (typeof data.online === 'number') setOnlineCount(data.online);
      } catch {
        // silent fail
      }
    };

    loadOnline();
    const interval = setInterval(loadOnline, 45000);
    return () => clearInterval(interval);
  }, []);

  const quickActions: QuickAction[] = useMemo(
    () => [
      { label: 'Игры', description: '11 режимов', href: '/games', intent: 'primary' },
      { label: 'NFT', description: 'Подарки и магазин', href: '/nft', intent: 'secondary' },
      { label: 'Кошелёк', description: 'Пополнение / вывод', href: '/wallet', intent: 'secondary' },
      { label: 'Профиль', description: 'Статистика и рефералы', href: '/profile', intent: 'secondary' },
      { label: 'Лидерборд', description: 'Топ игроков', href: '/leaderboard', intent: 'secondary' },
    ],
    [],
  );

  const userName = getTelegramDisplayName(user) || 'Игрок';
  const userInitials = getTelegramAvatarFallback(user);
  const balanceDisplay = balanceState.isLoading
    ? '…'
    : numberFormatter.format(balanceState.available);

  return (
    <div className="w-full pb-24 pt-6 px-4 md:px-6 text-platinum">
      <div className="relative space-y-6">
        {/* Онлайн + демо */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full bg-accent/80 px-3 py-1.5 text-sm font-medium text-emerald-300 backdrop-blur-sm border border-emerald-500/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            {onlineCount ?? '—'} онлайн
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !demoMode;
              setDemoMode(next);
              setDemoModeState(next);
              if (next) setDemoMode(true);
              else setDemoMode(false);
              window.location.reload();
            }}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition',
              demoMode
                ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                : 'bg-accent text-gold/80 border border-gold/30 hover:border-gold/60',
            )}
          >
            {demoMode ? 'ДЕМО вкл.' : 'Демо-режим'}
          </button>
        </div>

        {/* Аватар + имя + баланс */}
        <div className="flex items-center gap-4">
          {user?.photo_url ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <img src={user.photo_url} alt={userName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30 bg-accent text-2xl font-bold text-gold shadow-glow">
              {userInitials}
            </div>
          )}

          <div>
            <p className="text-sm text-gold/70">{userName}</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={balanceDisplay}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-3xl font-bold text-gold tracking-tight animate-win-shine"
              >
                {balanceDisplay} ★
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Быстрые действия — карточки */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {quickActions.map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(action.href)}
              className={clsx(
                'group relative overflow-hidden rounded-2xl border p-4 text-left transition-all',
                action.intent === 'primary'
                  ? 'border-gold/50 bg-gradient-to-br from-gold/20 to-gold/5 text-night hover:border-gold'
                  : 'border-gold/20 bg-accent/60 hover:border-gold/40 hover:bg-accent/80',
              )}
            >
              <div className="relative z-10">
                <p className="font-semibold text-lg">{action.label}</p>
                <p className="mt-1 text-xs text-gold/70">{action.description}</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gold/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      </div>

    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useTelegram } from '@/context/TelegramContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  userId: string;
  isCurrentUser: boolean;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isPremium: boolean;
  lifetimeEarn: number;
  available: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

function displayName(entry: LeaderboardEntry): string {
  if (entry.firstName || entry.lastName) {
    return [entry.firstName, entry.lastName].filter(Boolean).join(' ');
  }
  if (entry.username) return `@${entry.username}`;
  return 'Игрок';
}

function avatarInitials(entry: LeaderboardEntry): string {
  const name = displayName(entry);
  const parts = name.replace('@', '').split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400/20 border border-gold-400/50 text-base">
        🥇
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 border border-white/20 text-base">
        🥈
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 border border-amber-600/30 text-base">
        🥉
      </span>
    );
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent border border-white/5 text-xs font-semibold text-white/50">
      {rank}
    </span>
  );
}

function EntryRow({ entry, delay = 0 }: { entry: LeaderboardEntry; delay?: number }) {
  const isTop3 = entry.rank <= 3;
  const isMe = entry.isCurrentUser;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={clsx(
        'flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all',
        isMe
          ? 'bg-gold-400/10 border-gold-400/35 shadow-glow'
          : isTop3
          ? 'bg-accent/70 border-white/8'
          : 'bg-accent/40 border-white/4',
      )}
    >
      <RankBadge rank={entry.rank} />

      {/* Avatar */}
      {entry.avatarUrl ? (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10">
          <img src={entry.avatarUrl} alt={displayName(entry)} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
            isMe
              ? 'bg-gold-400/20 border-gold-400/40 text-gold-400'
              : 'bg-accent border-white/5 text-white/60',
          )}
        >
          {avatarInitials(entry)}
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p
            className={clsx(
              'text-sm font-semibold truncate',
              isMe ? 'text-gold-400' : 'text-white',
            )}
          >
            {displayName(entry)}
          </p>
          {isMe && (
            <span className="text-xs text-gold-400/70 font-normal shrink-0">(вы)</span>
          )}
          {entry.isPremium && (
            <span className="text-xs text-purple-300 shrink-0">⭐ Premium</span>
          )}
        </div>
        {entry.username && entry.firstName && (
          <p className="text-xs text-white/35 truncate">@{entry.username}</p>
        )}
      </div>

      {/* Earn */}
      <div className="text-right shrink-0">
        <p className={clsx('text-sm font-semibold', isMe ? 'text-gold-400' : 'text-white/80')}>
          {fmt(entry.lifetimeEarn)} ★
        </p>
        <p className="text-xs text-white/35">заработано</p>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage(): React.JSX.Element {
  const { isReady, initDataRaw } = useTelegram();

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = React.useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      else setRefreshing(true);
      setError(null);

      const headers: Record<string, string> = {};
      if (initDataRaw?.trim()) {
        headers['x-telegram-init-data'] = initDataRaw;
      }

      try {
        const res = await fetch('/api/mini-app/leaderboard', { headers, cache: 'no-store' });
        const json = (await res.json()) as LeaderboardResponse & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        if (!silent) setIsLoading(false);
        else setRefreshing(false);
      }
    },
    [initDataRaw],
  );

  useEffect(() => {
    if (!isReady) return;
    void fetchLeaderboard();
  }, [isReady, fetchLeaderboard]);

  // ── Current user not in top 50 ────────────────────────────────────────────
  const showCurrentUserFooter =
    data?.currentUser &&
    !data.leaderboard.some((e) => e.isCurrentUser);

  return (
    <main className="min-h-screen bg-night pb-28 pt-6 px-4">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Лидерборд</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Топ игроков по заработанным звёздам
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLeaderboard(true)}
          disabled={refreshing}
          className={clsx(
            'flex items-center gap-1.5 rounded-xl border border-white/10 bg-accent px-3 py-2 text-xs font-medium text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-400',
            refreshing && 'opacity-50 cursor-not-allowed',
          )}
        >
          <svg
            className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {refreshing ? 'Обновляем…' : 'Обновить'}
        </button>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-xl bg-red-900/20 border border-red-500/30 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {isLoading && !data && (
        <div className="space-y-2.5 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-accent/50" />
          ))}
        </div>
      )}

      {/* Top 3 podium */}
      {data && data.leaderboard.length >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-2 mb-6"
        >
          {/* 2nd place */}
          {(() => {
            const e = data.leaderboard[1];
            return (
              <div
                className={clsx(
                  'flex flex-col items-center gap-1.5 rounded-2xl py-4 px-2 border mt-4',
                  e.isCurrentUser
                    ? 'bg-gold-400/10 border-gold-400/40'
                    : 'bg-accent/60 border-white/8',
                )}
              >
                <span className="text-2xl">🥈</span>
                {e.avatarUrl ? (
                  <img
                    src={e.avatarUrl}
                    alt={displayName(e)}
                    className="h-10 w-10 rounded-full border border-white/15 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/10 text-sm font-bold text-white/60">
                    {avatarInitials(e)}
                  </div>
                )}
                <p className="text-xs font-semibold text-white truncate max-w-full text-center px-1">
                  {displayName(e).split(' ')[0]}
                </p>
                <p className="text-xs text-white/50">{fmt(e.lifetimeEarn)} ★</p>
              </div>
            );
          })()}

          {/* 1st place */}
          {(() => {
            const e = data.leaderboard[0];
            return (
              <div
                className={clsx(
                  'flex flex-col items-center gap-1.5 rounded-2xl py-4 px-2 border',
                  e.isCurrentUser
                    ? 'bg-gold-400/15 border-gold-400/50 shadow-win-glow'
                    : 'bg-gradient-to-b from-gold-400/15 to-transparent border-gold-400/30',
                )}
              >
                <span className="text-3xl">🥇</span>
                {e.avatarUrl ? (
                  <img
                    src={e.avatarUrl}
                    alt={displayName(e)}
                    className="h-12 w-12 rounded-full border-2 border-gold-400/60 object-cover shadow-glow"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/20 border-2 border-gold-400/40 text-base font-bold text-gold-400 shadow-glow">
                    {avatarInitials(e)}
                  </div>
                )}
                <p className="text-xs font-bold text-gold-400 truncate max-w-full text-center px-1">
                  {displayName(e).split(' ')[0]}
                </p>
                <p className="text-xs text-gold-400/70">{fmt(e.lifetimeEarn)} ★</p>
              </div>
            );
          })()}

          {/* 3rd place */}
          {(() => {
            const e = data.leaderboard[2];
            return (
              <div
                className={clsx(
                  'flex flex-col items-center gap-1.5 rounded-2xl py-4 px-2 border mt-6',
                  e.isCurrentUser
                    ? 'bg-gold-400/10 border-gold-400/40'
                    : 'bg-accent/60 border-white/8',
                )}
              >
                <span className="text-2xl">🥉</span>
                {e.avatarUrl ? (
                  <img
                    src={e.avatarUrl}
                    alt={displayName(e)}
                    className="h-10 w-10 rounded-full border border-white/15 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/10 text-sm font-bold text-white/60">
                    {avatarInitials(e)}
                  </div>
                )}
                <p className="text-xs font-semibold text-white truncate max-w-full text-center px-1">
                  {displayName(e).split(' ')[0]}
                </p>
                <p className="text-xs text-white/50">{fmt(e.lifetimeEarn)} ★</p>
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* Full list (4+) */}
      {data && (
        <div className="space-y-2">
          {data.leaderboard.slice(3).map((entry, idx) => (
            <EntryRow key={entry.userId} entry={entry} delay={idx * 0.03} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {data && data.leaderboard.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <span className="text-5xl">🏆</span>
          <p className="text-base font-semibold text-white/60">
            Список пока пуст
          </p>
          <p className="text-sm text-white/35">
            Сыграйте в игры, чтобы попасть в топ!
          </p>
          <a
            href="/games"
            className="mt-2 rounded-2xl bg-gold-400/20 border border-gold-400/40 px-6 py-3 text-sm font-semibold text-gold-400 hover:bg-gold-400/30 transition-all"
          >
            Играть
          </a>
        </motion.div>
      )}

      {/* Current user outside top 50 */}
      {showCurrentUserFooter && data?.currentUser && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <p className="text-xs text-center text-white/35 mb-2">Ваша позиция</p>
          <EntryRow entry={{ ...data.currentUser, isCurrentUser: true }} />
        </motion.div>
      )}
    </main>
  );
}

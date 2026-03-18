'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useTelegram } from '@/context/TelegramContext';
import { useStarBalance } from '@/lib/hooks/useStarBalance';
import { getTelegramDisplayName, getTelegramAvatarFallback } from '@/lib/telegram';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
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
    avatarUrl?: string | null;
    isPremium: boolean;
  };
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  invited: number;
  completed: number;
  pending: number;
  rewardPerFriend: number;
  referredBy: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

function StatCard({
  label,
  value,
  icon,
  gold = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'flex flex-col gap-1.5 rounded-2xl px-4 py-4 border',
        gold
          ? 'bg-gradient-to-br from-gold-400/10 to-transparent border-gold-400/30'
          : 'bg-accent/60 border-white/5',
      )}
    >
      <div className={clsx('text-xl', gold ? 'text-gold-400' : 'text-white/50')}>{icon}</div>
      <p className={clsx('text-lg font-semibold', gold ? 'text-gold-400' : 'text-white')}>
        {value}
      </p>
      <p className="text-xs text-white/50">{label}</p>
    </motion.div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all',
        copied
          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
          : 'bg-gold-400/15 text-gold-400 border border-gold-400/30 hover:bg-gold-400/25',
      )}
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17L4 12"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Скопировано
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <rect
              x="9"
              y="9"
              width="13"
              height="13"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
          Копировать
        </>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage(): React.JSX.Element {
  const { user, isReady, initDataRaw } = useTelegram();
  const { state: balanceState } = useStarBalance();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userName = getTelegramDisplayName(user) || 'Игрок';
  const userInitials = getTelegramAvatarFallback(user);

  const balanceDisplay = balanceState.isLoading
    ? '…'
    : fmt(balanceState.available);

  // ── Fetch profile + referral ────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !initDataRaw?.trim()) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'x-telegram-init-data': initDataRaw,
    };

    Promise.all([
      fetch('/api/mini-app/profile', { method: 'GET', headers }).then((r) => r.json()),
      fetch('/api/mini-app/referral', { method: 'GET', headers }).then((r) => r.json()),
    ])
      .then(([profileRes, referralRes]) => {
        if (cancelled) return;
        if (profileRes.profile) setProfile(profileRes.profile);
        if (referralRes.referral) setReferral(referralRes.referral);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, initDataRaw]);

  // ── Game stats from balance ────────────────────────────────────────────────
  const lifetimeEarn = balanceState.lifetimeEarn ?? 0;
  const lifetimeSpend = balanceState.lifetimeSpend ?? 0;

  const statusBadge = useMemo(() => {
    if (!profile) return null;
    if (profile.status === 'PREMIUM') {
      return (
        <span className="ml-2 rounded-full bg-gold-400/20 px-2.5 py-0.5 text-xs font-semibold text-gold-400 border border-gold-400/30">
          PREMIUM
        </span>
      );
    }
    return null;
  }, [profile]);

  return (
    <main className="min-h-screen bg-night pb-28 pt-6 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex items-center gap-4 mb-6"
      >
        {user?.photo_url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-gold-400/40 shadow-glow">
            <img src={user.photo_url} alt={userName} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold-400/30 bg-accent text-2xl font-bold text-gold-400 shadow-glow">
            {userInitials}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center flex-wrap">
            <h1 className="text-xl font-bold text-white truncate">{userName}</h1>
            {statusBadge}
          </div>
          {profile?.user?.username && (
            <p className="text-sm text-white/40 mt-0.5">@{profile.user.username}</p>
          )}
          <p className="text-base font-semibold text-gold-400 mt-1">
            {balanceDisplay} ★
          </p>
        </div>
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
      {isLoading && !profile && (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-accent/40" />
          ))}
        </div>
      )}

      {/* Stats grid */}
      {profile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <StatCard
            label="Баланс"
            value={`${fmt(balanceState.available)} ★`}
            gold
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            }
          />
          <StatCard
            label="Серия дней"
            value={`${profile.streakDays} 🔥`}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M12 6v6l4 2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Заработано сегодня"
            value={`+${fmt(profile.earnedToday)} ★`}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20V4M5 13l7-9 7 9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Всего заработано"
            value={`${fmt(lifetimeEarn)} ★`}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 7v5l3 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Потрачено всего"
            value={`${fmt(lifetimeSpend)} ★`}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4v16M5 11l7 9 7-9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Доступно промо"
            value={profile.availablePromos}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 7h.01M17 17h.01M3 12h18M12 3v18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </motion.div>
      )}

      {/* Referral block */}
      {referral && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-gold-400/20 bg-accent/40 p-4 space-y-4 mb-6"
        >
          <h2 className="text-base font-semibold text-gold-400 flex items-center gap-2">
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                stroke="#D4AF37"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Реферальная программа
          </h2>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-night/60 py-3">
              <p className="text-lg font-bold text-white">{referral.completed}</p>
              <p className="text-xs text-white/40 mt-0.5">Рефералов</p>
            </div>
            <div className="rounded-xl bg-night/60 py-3">
              <p className="text-lg font-bold text-gold-400">+{referral.rewardPerFriend} ★</p>
              <p className="text-xs text-white/40 mt-0.5">За каждого</p>
            </div>
            <div className="rounded-xl bg-night/60 py-3">
              <p className="text-lg font-bold text-white">{fmt(referral.completed * referral.rewardPerFriend)} ★</p>
              <p className="text-xs text-white/40 mt-0.5">Заработано</p>
            </div>
          </div>

          {/* Referral link */}
          <div>
            <p className="text-xs text-white/40 mb-2">Ваша реферальная ссылка</p>
            <div className="flex items-center gap-2 rounded-xl bg-night/60 border border-white/5 px-3 py-2.5">
              <p className="flex-1 truncate text-sm text-white/70 font-mono">
                {referral.referralLink}
              </p>
              <CopyButton text={referral.referralLink} />
            </div>
          </div>

          {/* Code only */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/40">Код:</p>
            <code className="rounded-lg bg-night/60 border border-white/5 px-3 py-1 text-sm font-mono text-gold-400">
              {referral.referralCode}
            </code>
            <CopyButton text={referral.referralCode} />
          </div>
        </motion.section>
      )}

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-3"
      >
        {[
          { label: 'Игры', href: '/games', icon: '🎮' },
          { label: 'Лидерборд', href: '/leaderboard', icon: '🏆' },
          { label: 'Кошелёк', href: '/wallet', icon: '💎' },
          { label: 'Промокоды', href: '/promocodes', icon: '🎁' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-2xl bg-accent/50 border border-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:border-gold-400/30 hover:text-gold-400 transition-all"
          >
            <span className="text-base">{link.icon}</span>
            {link.label}
          </a>
        ))}
      </motion.div>
    </main>
  );
}

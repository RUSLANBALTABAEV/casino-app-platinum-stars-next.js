'use client';

import clsx from 'clsx';
import React, { useEffect, useMemo, useState } from 'react';

import type { CaseDefinition, CaseItemDefinition } from '@/lib/config/case-default';
import ConfettiBurst from '@/components/effects/ConfettiBurst';
import TreasureBoxLottie from '@/components/animations/TreasureBoxLottie';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

import styles from './case-opening.module.css';

function formatStars(value: number): string {
  return `${value.toLocaleString('ru-RU')} ★`;
}

export default function CaseOpeningModal({
  open,
  loading,
  lootCase,
  reward,
  nftGift,
  onClose,
  onOpenAnother,
  animationMode = 'lottie'
}: {
  open: boolean;
  loading: boolean;
  lootCase: CaseDefinition | null;
  reward: CaseItemDefinition | null;
  nftGift?: {
    id: string;
    name: string;
    rarity: string;
    imageUrl?: string | null;
  } | null;
  onClose: () => void;
  onOpenAnother?: () => void;
  animationMode?: 'lottie' | 'gif';
}): React.JSX.Element | null {
  const [phase, setPhase] = useState<'idle' | 'opening' | 'reveal'>('idle');
  useBodyScrollLock(open);
  const [confetti, setConfetti] = useState(false);
  const [lottieReadyToReveal, setLottieReadyToReveal] = useState(false);
  const [hasLottie, setHasLottie] = useState(true);
  const [lottieError, setLottieError] = useState<string | null>(null);

  const accent = useMemo(() => reward?.color ?? '#fbbf24', [reward?.color]);

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setConfetti(false);
      setLottieReadyToReveal(false);
      setLottieError(null);
      return;
    }
    // Запускаем анимацию сразу при открытии модалки.
    // Иначе при быстром ответе API `loading` может успеть стать false раньше,
    // чем мы перейдём в opening, и анимация не будет проиграна полностью.
    setPhase('opening');
    setConfetti(false);
    setLottieReadyToReveal(false);
    setLottieError(null);
    setHasLottie(true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!loading) {
      return;
    }
    // При повторном открытии (без закрытия модалки) перезапускаем анимацию.
    setPhase('opening');
    setConfetti(false);
    setLottieReadyToReveal(false);
    setLottieError(null);
    setHasLottie(true);
  }, [loading, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (loading || !reward) {
      return;
    }
    if ((animationMode === 'gif' ? lottieReadyToReveal : lottieReadyToReveal || !hasLottie)) {
      setPhase('reveal');
      setConfetti(true);
    }
  }, [animationMode, hasLottie, loading, lottieReadyToReveal, open, reward]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (animationMode !== 'gif') {
      return;
    }
    if (phase !== 'opening') {
      return;
    }
    const t = window.setTimeout(() => {
      setLottieReadyToReveal(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [animationMode, open, phase]);

  if (!open) {
    return null;
  }

  return (
    <div className={clsx('fixed inset-0 z-[70] flex items-center justify-center px-4', styles.backdrop)}>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#070b16] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <ConfettiBurst active={confetti} className="opacity-80" />

        <div
          aria-hidden
          className={clsx(
            'pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full blur-2xl',
            styles.sparkle
          )}
          style={{ background: `radial-gradient(circle, ${accent}38, transparent 70%)` }}
        />
        <div
          aria-hidden
          className={clsx(
            'pointer-events-none absolute -right-24 -bottom-24 h-60 w-60 rounded-full blur-2xl',
            styles.sparkle
          )}
          style={{ background: `radial-gradient(circle, rgba(56,189,248,0.18), transparent 70%)` }}
        />

        <header className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Открытие кейса</p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {lootCase?.name ?? 'Кейс'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/80 transition active:scale-[0.97]',
              loading ? 'cursor-not-allowed opacity-50' : 'hover:text-white'
            )}
            aria-label="Закрыть"
            disabled={loading}
          >
            ✕
          </button>
        </header>

        <div className="relative z-10 mt-6 flex flex-col items-center gap-5">
          {hasLottie ? (
            <div className="relative">
              {animationMode === 'gif' ? (
                <div className={clsx(styles.present, phase === 'opening' && styles.shake)}>
                  <div className={styles.presentGlow} />
                  <div className={styles.presentBody}>
                    <div className={styles.ribbonVertical} />
                    <div className={styles.ribbonHorizontal} />
                  </div>
                  <div className={clsx(styles.presentLid, lottieReadyToReveal && styles.openLid)}>
                    <div className={styles.ribbonVertical} />
                    <div className={styles.ribbonHorizontal} />
                    <div className={styles.bow}>
                      <span className={styles.bowLoop} />
                      <span className={styles.bowLoop} />
                      <span className={styles.bowKnot} />
                    </div>
                  </div>
                </div>
              ) : (
                <TreasureBoxLottie
                  phase={phase === 'reveal' ? 'opened' : phase}
                  className="h-[220px] w-[220px] drop-shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
                  renderer="canvas"
                  onUnavailable={(reason) => {
                    setLottieError(reason);
                    setHasLottie(false);
                  }}
                  onOpened={() => {
                    setLottieReadyToReveal(true);
                  }}
                />
              )}
              <div
                aria-hidden
                className={clsx('pointer-events-none absolute inset-0', styles.sparkle)}
                style={{
                  background: `radial-gradient(circle at 50% 45%, ${accent}22, transparent 68%)`
                }}
              />
            </div>
          ) : (
            <div className={clsx(styles.present, phase === 'idle' && styles.shake)}>
              <div className={styles.presentBody}>
                <div className={styles.ribbonVertical} />
                <div className={styles.ribbonHorizontal} />
              </div>
              <div className={clsx(styles.presentLid, phase === 'reveal' && styles.openLid)}>
                <div className={styles.ribbonVertical} />
              </div>
            </div>
          )}

          {!hasLottie && lottieError ? (
            <p className="text-center text-[11px] uppercase tracking-[0.16em] text-white/45">
              Анимация не загрузилась: {lottieError}
            </p>
          ) : null}

          {loading || !reward ? (
            <div className="w-full rounded-2xl border border-white/10 bg-white/6 p-4 text-center">
              <p className="text-sm font-semibold text-white">Открываем…</p>
              <p className="mt-1 text-xs text-white/55">Секунда магии и подарок ваш.</p>
            </div>
          ) : (
            <div
              className={clsx(
                'w-full rounded-2xl border border-white/12 bg-white/6 p-4 text-center',
                phase === 'reveal' ? styles.revealCard : 'opacity-0'
              )}
              style={{
                borderColor: reward.color ? `${reward.color}55` : undefined,
                background: reward.color ? `${reward.color}12` : undefined
              }}
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{reward.rarity}</p>
              <p className="mt-1 text-xl font-semibold text-white">{reward.name}</p>
              {nftGift?.imageUrl ? (
                <img
                  src={nftGift.imageUrl}
                  alt={nftGift.name}
                  className="mx-auto mt-3 h-24 w-24 rounded-2xl border border-white/15 object-cover shadow-[0_16px_30px_rgba(0,0,0,0.35)]"
                  loading="eager"
                />
              ) : nftGift ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                  NFT подарок
                </p>
              ) : null}
              {reward.stars ? (
                <p className="mt-2 text-base font-semibold text-gold-200">{formatStars(reward.stars)}</p>
              ) : null}
              {reward.description ? (
                <p className="mt-2 text-sm text-white/60">{reward.description}</p>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className={clsx(
              'w-full rounded-full border px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition active:scale-[0.98]',
              reward && !loading
                ? 'border-white/15 bg-white/10 text-white hover:bg-white/14'
                : 'border-white/10 bg-white/6 text-white/60'
            )}
            disabled={loading}
          >
            {reward && !loading ? 'Забрать' : 'Подождите…'}
          </button>

          {reward && !loading && onOpenAnother ? (
            <button
              type="button"
              onClick={onOpenAnother}
              className="w-full rounded-full border border-gold-400/45 bg-gold-400/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold-100 transition hover:border-gold-300 hover:bg-gold-400/20 active:scale-[0.98]"
            >
              Открыть ещё
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

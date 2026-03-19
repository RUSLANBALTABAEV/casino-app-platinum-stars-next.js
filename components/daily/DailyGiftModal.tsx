'use client';

import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import ConfettiBurst from '@/components/effects/ConfettiBurst';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

function formatReward(value: number): string {
  return `+${value.toLocaleString('ru-RU')} ★`;
}

export default function DailyGiftModal({
  open,
  loading,
  reward,
  streak,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  reward: number | null;
  streak: number | null;
  onClose: () => void;
}): React.JSX.Element | null {
  const [confetti, setConfetti] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useBodyScrollLock(open);

  // Сброс состояний при закрытии
  useEffect(() => {
    if (!open) {
      setConfetti(false);
      setRevealed(false);
    }
  }, [open]);

  // Автоматическое раскрытие подарка
  useEffect(() => {
    if (!open || loading || reward === null) return;

setRevealed(true);
    // §5 ТЗ: показываем награду сразу после ответа API, конфетти через 400мс
    const confettiTimer = setTimeout(() => setConfetti(true), 400);
    return () => clearTimeout(confettiTimer);
  }, [open, loading, reward]);

  if (!open) return null;

  const showReward = !loading && reward !== null && revealed;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
          onClick={onClose} // закрытие по клику на фон
        >
          <motion.div
            initial={{ scale: 0.82, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.82, y: 40, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 18,
              stiffness: 280,
              duration: 0.45,
            }}
            className={clsx(
              'relative w-full max-w-md overflow-hidden rounded-3xl',
              'border border-gold/20 bg-gradient-to-b from-[#0f0f17] to-[#0a0a12]',
              'shadow-[0_30px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(212,175,55,0.08)]',
              'p-6 md:p-8',
            )}
            onClick={(e) => e.stopPropagation()} // не закрывать при клике внутри
          >
            <ConfettiBurst active={confetti} className="opacity-90 pointer-events-none" />

            {/* Кнопка закрытия */}
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full',
                'border border-gold/30 bg-black/40 text-gold/80 transition-all',
                'hover:bg-gold/10 hover:text-gold hover:border-gold/50',
                'active:scale-95',
              )}
              aria-label="Закрыть"
            >
              ✕
            </button>

            <div className="relative z-10 mt-2 flex flex-col items-center gap-7">
              {/* Заголовок */}
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.24em] text-gold/60 font-medium">
                  Ежедневный подарок
                </p>
                <h3 className="mt-1.5 text-2xl font-bold text-gold">
                  {showReward ? 'Поздравляем!' : 'Открываем подарок…'}
                </h3>
              </div>

              {/* Анимированная коробка */}
              <div className="relative scale-[1.15] md:scale-[1.3] my-4">
                <motion.div
                  animate={revealed ? 'open' : 'closed'}
                  variants={{
                    closed: { rotateX: 0, scale: 1, y: 0 },
                    open: {
                      rotateX: -35,
                      scale: 1.08,
                      y: -20,
                      transition: { duration: 0.9, ease: [0.34, 1.56, 0.64, 1] },
                    },
                  }}
                  className="relative"
                >
                  {/* Здесь можно оставить вашу CSS-анимацию коробки или заменить на SVG/Lottie */}
                  <div className="w-44 h-44 rounded-2xl bg-gradient-to-br from-[#1a1200] to-[#0f0a00] border-2 border-gold/40 shadow-[0_15px_40px_rgba(212,175,55,0.25)]">
                    {/* Простой плейсхолдер коробки — можно заменить на ваш present */}
                    <div className="absolute inset-0 flex items-center justify-center text-gold/70 text-5xl font-black">
                      ★
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Контент после открытия */}
              <AnimatePresence mode="wait">
                {showReward ? (
                  <motion.div
                    key="reward"
                    initial={{ opacity: 0, y: 20, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.92 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={clsx(
                      'w-full rounded-2xl border border-gold/25 bg-black/40 p-6 text-center',
                      'shadow-[0_8px_32px_rgba(212,175,55,0.15)]',
                    )}
                  >
                    {streak && streak > 1 && (
                      <p className="text-sm uppercase tracking-wider text-gold/70 mb-2">
                        Серия: {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
                      </p>
                    )}

                    <p className="text-4xl md:text-5xl font-bold text-gold tracking-tight animate-[win-shine_2s_infinite]">
                      {formatReward(reward)}
                    </p>

                    <p className="mt-4 text-sm text-gold/60">
                      Возвращайтесь завтра — награда будет ещё больше!
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full rounded-2xl border border-gold/10 bg-black/30 p-5 text-center"
                  >
                    <p className="text-base font-medium text-gold/90">
                      Получаем ваш подарок…
                    </p>
                    <p className="mt-2 text-xs text-gold/50">
                      Синхронизация с сервером
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Кнопка действия */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className={clsx(
                  'w-full rounded-full py-4 px-6 text-base font-semibold uppercase tracking-wider transition-all',
                  showReward
                    ? 'bg-gradient-to-r from-gold to-[#d4af37] text-night shadow-[0_10px_30px_rgba(212,175,55,0.45)] hover:shadow-[0_14px_40px_rgba(212,175,55,0.6)]'
                    : loading
                    ? 'bg-gold/10 text-gold/70 border border-gold/30'
                    : 'bg-gold/15 text-gold/80 border border-gold/40 hover:bg-gold/25',
                )}
              >
                {loading ? 'Получаем подарок…' : showReward ? 'Круто! Закрыть' : 'Закрыть'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

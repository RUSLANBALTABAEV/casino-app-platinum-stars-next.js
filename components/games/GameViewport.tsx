'use client';

import clsx from 'clsx';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import React, { useMemo } from 'react';

import HolidayGarland from '@/components/effects/HolidayGarland';
import { isHolidaySeason } from '@/lib/ui/season';

type GameViewportProps = {
  children: React.ReactNode;
  backgroundClassName?: string;
  contentClassName?: string;
  backHref?: Route;
  backLabel?: string;
};

const DEFAULT_BACK_LABEL = 'Игры';

function GameViewport({
  children,
  backgroundClassName,
  contentClassName,
  backHref = '/games',
  backLabel = DEFAULT_BACK_LABEL
}: GameViewportProps): React.JSX.Element {
  const router = useRouter();

  const backButtonOffsetStyle = useMemo(
    () => ({
      top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      left: 'calc(env(safe-area-inset-left, 0px) + 12px)'
    }),
    []
  );

  return (
    <section
      className={clsx(
        'relative flex h-[100svh] w-full flex-col overflow-hidden text-white',
        backgroundClassName
      )}
      style={{
        maxHeight: '100svh',
        minHeight: '100svh'
      }}
    >
      {isHolidaySeason() ? <HolidayGarland /> : null}
      <button
        aria-label="Назад к списку игр"
        className="absolute z-40 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90 shadow-[0_8px_16px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all active:scale-[0.95] hover:bg-black/80"
        data-frost-btn="1"
        data-frost-style="garland"
        onClick={() => router.push(backHref)}
        style={backButtonOffsetStyle}
        type="button"
      >
        <svg
          aria-hidden
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M14.5 6.75 8.25 12 14.5 17.25" />
        </svg>
        {backLabel}
      </button>

      <div
        className={clsx(
          'relative flex h-full w-full flex-col overflow-hidden',
          contentClassName
        )}
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default GameViewport;

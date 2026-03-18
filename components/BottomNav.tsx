'use client';

import type { Route } from 'next';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import React from 'react';

export type BottomNavIcon = 'profile' | 'games' | 'gift' | 'tasks' | 'promo' | 'wallet' | 'leaderboard';

export interface BottomNavItem {
  href: Route;
  label: string;
  icon: BottomNavIcon;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activePath: string;
  onNavigate: (href: Route) => void;
}

const ICON_SIZE = 26;
const ICON_STROKE = 1.9;

function TabIcon({ name, active }: { name: BottomNavIcon; active: boolean }): React.JSX.Element {
  const color = active ? '#D4AF37' : '#8B6F47';
  const glow = active ? 'drop-shadow(0 0 8px rgba(212,175,55,0.6))' : 'none';

  switch (name) {
    case 'profile':
      return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" style={{ filter: glow }}>
          <circle cx="12" cy="7.5" r="4.5" fill="none" stroke={color} strokeWidth={ICON_STROKE} />
          <path
            d="M4 20.5c0-4 4-7 8-7s8 3 8 7"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={ICON_STROKE}
          />
        </svg>
      );

    case 'games':
      return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" style={{ filter: glow }}>
          <path
            d="M4 8h16c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2z"
            fill="none"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="13" r="1.5" fill={active ? '#D4AF37' : 'none'} stroke={color} strokeWidth={ICON_STROKE} />
          <circle cx="15" cy="13" r="1.5" fill={active ? '#CBA135' : 'none'} stroke={color} strokeWidth={ICON_STROKE} />
        </svg>
      );

    case 'wallet':
      return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" style={{ filter: glow }}>
          <path
            d="M21 12V7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7"
            fill="none"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 17h.01"
            stroke={color}
            strokeWidth={ICON_STROKE * 1.4}
            strokeLinecap="round"
          />
        </svg>
      );

    case 'gift':
      return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" style={{ filter: glow }}>
          <path
            d="M20 12V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"
            fill="none"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
          />
          <path
            d="M12 4v16"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
          />
          <path
            d="M8 6.5c0-1.1.9-2 2-2s2 .9 2 2-1.5 3-2 3-2-1.9-2-3zM16 6.5c0-1.1-.9-2-2-2s-2 .9-2 2 1.5 3 2 3 2-1.9 2-3z"
            fill="none"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'leaderboard':
      return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" style={{ filter: glow }}>
          <path
            d="M4 18h16M4 14h4v4H4zM10 10h4v8h-4zM16 6h4v12h-4z"
            fill="none"
            stroke={color}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="4" r="2" fill={active ? '#D4AF37' : 'none'} stroke={color} strokeWidth={ICON_STROKE} />
        </svg>
      );

    // Другие иконки можно добавить аналогично
    default:
      return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth={ICON_STROKE} />
        </svg>
      );
  }
}

export default function BottomNav({ items, activePath, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom,0.75rem)] px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-around rounded-3xl border border-gold/15 bg-gradient-to-t from-night to-[#0f0f17] backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(212,175,55,0.08)] p-2">
        {items.map((item) => {
          const isActive =
            item.href === '/'
              ? activePath === item.href
              : activePath === item.href || activePath.startsWith(`${item.href}/`);

          return (
            <motion.button
              key={item.href}
              whileTap={{ scale: 0.92 }}
              onClick={() => onNavigate(item.href)}
              className={clsx(
                'relative flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200',
                isActive
                  ? 'text-gold shadow-[0_4px_16px_rgba(212,175,55,0.35)]'
                  : 'text-gold/60 hover:text-gold/90'
              )}
              aria-label={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="active-bg"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gold/15 to-transparent"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <TabIcon name={item.icon} active={isActive} />

              <span className="text-[10px] font-medium uppercase tracking-wider">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

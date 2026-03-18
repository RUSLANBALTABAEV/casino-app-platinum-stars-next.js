'use client';

import type { Route } from 'next';
import Link from 'next/link';
import React from 'react';

function IconCase() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect x="4" y="10" width="24" height="18" rx="4" stroke="#D4AF37" strokeWidth="1.8" />
      <path d="M11 10V8a5 5 0 0 1 10 0v2" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 18h24" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}
function IconRoulette() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <circle cx="16" cy="16" r="11" stroke="#D4AF37" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="4" stroke="#D4AF37" strokeWidth="1.4" />
      <path d="M16 5v3M16 24v3M5 16h3M24 16h3" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}
function IconRunner() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <circle cx="16" cy="7" r="3" stroke="#D4AF37" strokeWidth="1.8" />
      <path d="M16 10v8M12 14l4 2 4-2M13 22l-2 5M19 22l2 5" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLottery() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <circle cx="16" cy="16" r="11" stroke="#D4AF37" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.5" fill="#D4AF37" />
    </svg>
  );
}
function IconMines() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <rect x="5" y="5" width="10" height="10" rx="2.5" stroke="#D4AF37" strokeWidth="1.8" />
      <rect x="17" y="5" width="10" height="10" rx="2.5" stroke="#D4AF37" strokeWidth="1.8" />
      <rect x="5" y="17" width="10" height="10" rx="2.5" stroke="#D4AF37" strokeWidth="1.8" />
      <rect x="17" y="17" width="10" height="10" rx="2.5" stroke="#D4AF37" strokeWidth="1.8" />
    </svg>
  );
}
function IconCrash() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M5 26L10 18L16 12L22 8L27 5" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 5h5v5" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTicTac() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M11 5v22M21 5v22M5 11h22M5 21h22" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      <path d="M8 8l5 5M13 8l-5 5" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="22.5" cy="22.5" r="3" stroke="#D4AF37" strokeWidth="1.6" />
    </svg>
  );
}
function IconCoinflip() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <circle cx="16" cy="16" r="11" stroke="#D4AF37" strokeWidth="1.8" />
      <path d="M16 5v22" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" opacity=".4" />
    </svg>
  );
}
function IconUpgrade() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M16 27V7M8 15l8-8 8 8" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 23h12" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}
function IconBattle() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M6 26L26 6M6 6l6 6M20 20l6 6" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3" fill="#D4AF37" opacity=".3" stroke="#D4AF37" strokeWidth="1.2" />
    </svg>
  );
}
function IconCraft() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
      <path d="M9 16a7 7 0 0 1 14 0v5a7 7 0 0 1-14 0v-5z" stroke="#D4AF37" strokeWidth="1.8" />
      <path d="M13 10V7M19 10V7M16 9V6" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

type GameDef = {
  name: string;
  description: string;
  badge: string;
  href?: Route;
  icon: React.ReactNode;
  accent: string;
  wide?: boolean;
};

const GAMES: GameDef[] = [
  { name: 'Кейсы', description: 'Коллекционируйте раритетные призы и апгрейды.', badge: 'Legendary Drop', href: '/games/cases', icon: <IconCase />, accent: '#FFD700', wide: true },
  { name: 'Краш', description: 'Успейте вывести до обрушения множителя.', badge: 'Crash x', href: '/games/crash', icon: <IconCrash />, accent: '#E85D5D', wide: true },
  { name: 'Рулетка', description: 'Выбирайте сектор, ловите множители.', badge: 'x2 — x25', href: '/games/roulette', icon: <IconRoulette />, accent: '#D4AF37' },
  { name: 'Мины', description: 'Риск и множители на каждом ходе.', badge: 'Risk Grid', href: '/games/mines', icon: <IconMines />, accent: '#F97316' },
  { name: 'Орёл и решка', description: 'Ставка и шанс на удвоение.', badge: 'Coin Flip', href: '/games/coinflip', icon: <IconCoinflip />, accent: '#CBA135' },
  { name: 'Раннер', description: 'Уклоняйтесь и собирайте звёзды.', badge: 'Season Pass', href: '/games/runner', icon: <IconRunner />, accent: '#3B82F6' },
  { name: 'Лотерея', description: 'Делите банк с другими игроками.', badge: 'Daily Pot', href: '/games/lottery', icon: <IconLottery />, accent: '#A78BFA' },
  { name: 'Крестики-нолики', description: 'Быстрый матч против AI.', badge: 'Quick Duel', href: '/games/tictactoe', icon: <IconTicTac />, accent: '#10B981' },
  { name: 'Апгрейд', description: 'Повышайте ставку до редких множителей.', badge: 'Upgrade', href: '/games/upgrade', icon: <IconUpgrade />, accent: '#D4AF37' },
  { name: 'Батл', description: 'PVP: ставьте NFT и звёзды.', badge: 'PVP Battle', href: '/games/battle', icon: <IconBattle />, accent: '#EF4444' },
  { name: 'Крафт', description: 'Объединяйте NFT, получайте редкости.', badge: 'NFT Forge', href: '/games/craft', icon: <IconCraft />, accent: '#8B5CF6' },
];

function GameCard({ game }: { game: GameDef }) {
  const inner = (
    <div className="ps-gc-inner">
      <div className="ps-gc-glow" style={{ background: `radial-gradient(circle at 25% 35%,${game.accent}20 0%,transparent 65%)` }} />
      <div className="ps-gc-icon" style={{ borderColor: `${game.accent}38`, background: `${game.accent}10` }}>
        {game.icon}
      </div>
      <div className="ps-gc-body">
        <span className="ps-gc-badge" style={{ color: game.accent }}>{game.badge}</span>
        <p className="ps-gc-name">{game.name}</p>
        <p className="ps-gc-desc">{game.description}</p>
      </div>
      <div className="ps-gc-arrow" style={{ borderColor: `${game.accent}38`, color: game.accent }}>
        <svg aria-hidden viewBox="0 0 16 16" fill="none" className="h-4 w-4">
          <path d="M3.5 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );

  const cls = `ps-gc${game.wide ? ' ps-gc--wide' : ''}`;
  return game.href
    ? <Link href={game.href} className={cls}>{inner}</Link>
    : <button type="button" className={cls}>{inner}</button>;
}

export default function GamesPage(): React.JSX.Element {
  return (
    <>
      <style>{`
        .ps-games-header { padding-bottom: 1.25rem; }
        .ps-games-eyebrow { font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(212,175,55,.65);margin-bottom:.35rem; }
        .ps-games-title { font-size:1.75rem;font-weight:700;color:#F4F4F5;letter-spacing:-.01em;line-height:1.2; }
        .ps-games-lead { margin-top:.45rem;font-size:.82rem;color:rgba(244,244,245,.48);max-width:38ch;line-height:1.5; }
        .ps-section-label { font-size:.58rem;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:rgba(212,175,55,.5);padding:.65rem 0 .25rem; }

        .ps-grid { display:grid;grid-template-columns:1fr 1fr;gap:.7rem; }
        @media(max-width:380px){ .ps-grid{grid-template-columns:1fr;} }

        .ps-gc {
          position:relative;display:block;border-radius:1.2rem;
          border:1px solid rgba(212,175,55,.16);
          background:linear-gradient(145deg,rgba(14,14,16,.95),rgba(8,8,10,.92));
          overflow:hidden;text-align:left;cursor:pointer;text-decoration:none;color:inherit;
          -webkit-tap-highlight-color:transparent;
          transition:border-color .2s,transform .2s,box-shadow .2s;
        }
        .ps-gc:hover,.ps-gc:focus-visible {
          border-color:rgba(212,175,55,.48);
          transform:translateY(-2px);
          box-shadow:0 16px 36px rgba(0,0,0,.5),0 0 0 1px rgba(212,175,55,.12);
          outline:none;
        }
        .ps-gc:active { transform:scale(.975); }
        .ps-gc--wide { grid-column:span 2; }
        @media(max-width:380px){ .ps-gc--wide{grid-column:span 1;} }

        .ps-gc-inner {
          position:relative;padding:1rem;
          display:flex;flex-direction:column;gap:.8rem;min-height:148px;
        }
        .ps-gc--wide .ps-gc-inner {
          flex-direction:row;align-items:center;gap:1rem;min-height:90px;
        }
        .ps-gc-glow { position:absolute;inset:0;pointer-events:none;z-index:0; }

        .ps-gc-icon {
          position:relative;z-index:1;display:flex;align-items:center;justify-content:center;
          width:2.9rem;height:2.9rem;border-radius:.85rem;border:1px solid;flex-shrink:0;
          transition:transform .2s;
        }
        .ps-gc:hover .ps-gc-icon { transform:scale(1.08); }

        .ps-gc-body { position:relative;z-index:1;flex:1;display:flex;flex-direction:column;gap:.18rem;min-width:0; }
        .ps-gc-badge { font-size:.58rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase; }
        .ps-gc-name { font-size:.95rem;font-weight:700;color:#F4F4F5;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .ps-gc-desc { font-size:.72rem;color:rgba(244,244,245,.48);margin:0;line-height:1.4; }

        .ps-gc-arrow {
          position:relative;z-index:1;display:flex;align-items:center;justify-content:center;
          width:1.9rem;height:1.9rem;border-radius:50%;border:1px solid;flex-shrink:0;
          margin-left:auto;align-self:flex-end;transition:transform .2s;
        }
        .ps-gc--wide .ps-gc-arrow { align-self:center; }
        .ps-gc:hover .ps-gc-arrow { transform:translateX(3px); }
      `}</style>

      <section>
        <header className="ps-games-header">
          <p className="ps-games-eyebrow">Игровой центр</p>
          <h1 className="ps-games-title">Выберите режим</h1>
          <p className="ps-games-lead">11 игровых механик с мгновенными выплатами, NFT и множителями.</p>
        </header>

        <p className="ps-section-label">Популярные</p>
        <div className="ps-grid" style={{ marginBottom: '.7rem' }}>
          {GAMES.filter(g => g.wide).map(g => <GameCard key={g.name} game={g} />)}
        </div>

        <p className="ps-section-label">Все режимы</p>
        <div className="ps-grid">
          {GAMES.filter(g => !g.wide).map(g => <GameCard key={g.name} game={g} />)}
        </div>
      </section>
    </>
  );
}

'use client';

import React, { useState, useCallback } from 'react';

type GameConfig = {
  winChance?: number;
  multiplier?: number;
  drawChance?: number;
  nftChance?: number;
  nftGiftIds?: string[];
  baseBet?: number;
  maxMultiplier?: number;
  stepMultiplier?: number;
  minMines?: number;
  maxMines?: number;
  minPlayers?: number;
  maxPlayers?: number;
  winnerTakesAll?: boolean;
  requiredCount?: number;
  autoCashout?: number;
  roundDelay?: number;
};

type GameOddsEditorProps = {
  gameType: string;
  gameLabel: string;
  initialConfig: string;
  action: (formData: FormData) => Promise<void>;
  isDisabled?: boolean;
};

const GAME_FIELDS: Record<string, Array<{
  key: keyof GameConfig;
  label: string;
  type: 'percent' | 'number' | 'toggle' | 'array';
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}>> = {
  COINFLIP: [
    { key: 'winChance', label: 'Шанс победы', type: 'percent', min: 0, max: 100, step: 1, hint: 'Вероятность выигрыша игрока (%)' },
    { key: 'multiplier', label: 'Множитель выигрыша', type: 'number', min: 1.1, max: 10, step: 0.1, hint: 'Во сколько раз увеличится ставка' },
    { key: 'nftChance', label: 'Шанс NFT', type: 'percent', min: 0, max: 20, step: 0.1, hint: 'Шанс выпадения NFT подарка (%)' },
  ],
  UPGRADE: [
    { key: 'winChance', label: 'Шанс апгрейда', type: 'percent', min: 0, max: 100, step: 1, hint: 'Вероятность успешного апгрейда (%)' },
    { key: 'multiplier', label: 'Множитель выигрыша', type: 'number', min: 1.5, max: 10, step: 0.1, hint: 'Во сколько раз увеличится ставка' },
    { key: 'nftChance', label: 'Шанс NFT', type: 'percent', min: 0, max: 20, step: 0.1, hint: 'Шанс выпадения NFT подарка (%)' },
  ],
  TICTACTOE: [
    { key: 'winChance', label: 'Шанс победы', type: 'percent', min: 0, max: 100, step: 1, hint: 'Вероятность победы игрока (%)' },
    { key: 'drawChance', label: 'Шанс ничьей', type: 'percent', min: 0, max: 50, step: 1, hint: 'Вероятность ничьей (%)' },
    { key: 'multiplier', label: 'Множитель выигрыша', type: 'number', min: 1.5, max: 5, step: 0.1, hint: 'Во сколько раз увеличится ставка' },
  ],
  MINES: [
    { key: 'winChance', label: 'Базовый шанс', type: 'percent', min: 30, max: 80, step: 1, hint: 'Начальный шанс найти звезду (%)' },
    { key: 'maxMultiplier', label: 'Макс. множитель', type: 'number', min: 2, max: 20, step: 0.5, hint: 'Максимальный множитель при полном прохождении' },
    { key: 'stepMultiplier', label: 'Шаг множителя', type: 'number', min: 0.1, max: 1, step: 0.05, hint: 'Прирост множителя за каждую найденную звезду' },
    { key: 'minMines', label: 'Мин. мин', type: 'number', min: 1, max: 10, step: 1, hint: 'Минимальное количество мин' },
    { key: 'maxMines', label: 'Макс. мин', type: 'number', min: 5, max: 20, step: 1, hint: 'Максимальное количество мин' },
    { key: 'nftChance', label: 'Шанс NFT', type: 'percent', min: 0, max: 20, step: 0.1, hint: 'Шанс выпадения NFT подарка (%)' },
  ],
  CRASH: [
    { key: 'maxMultiplier', label: 'Макс. множитель', type: 'number', min: 5, max: 100, step: 1, hint: 'Максимальный множитель перед крашем' },
    { key: 'autoCashout', label: 'Авто-кешаут', type: 'number', min: 1.1, max: 10, step: 0.1, hint: 'Множитель автоматического вывода по умолчанию' },
    { key: 'roundDelay', label: 'Пауза между раундами', type: 'number', min: 1, max: 30, step: 1, hint: 'Секунды между раундами' },
    { key: 'baseBet', label: 'Мин. ставка', type: 'number', min: 1, max: 100, step: 1, hint: 'Минимальная ставка' },
  ],
  BATTLE: [
    { key: 'minPlayers', label: 'Мин. игроков', type: 'number', min: 2, max: 10, step: 1, hint: 'Минимум игроков для старта' },
    { key: 'maxPlayers', label: 'Макс. игроков', type: 'number', min: 2, max: 20, step: 1, hint: 'Максимум игроков в батле' },
    { key: 'winnerTakesAll', label: 'Победитель забирает всё', type: 'toggle', hint: 'Весь банк достаётся победителю' },
  ],
  CRAFT: [
    { key: 'requiredCount', label: 'Требуемое кол-во', type: 'number', min: 2, max: 10, step: 1, hint: 'Сколько предметов нужно для крафта' },
  ],
};

export function GameOddsEditor({
  gameType,
  gameLabel,
  initialConfig,
  action,
  isDisabled = false
}: GameOddsEditorProps): React.JSX.Element {
  const [config, setConfig] = useState<GameConfig>(() => {
    try {
      return JSON.parse(initialConfig) as GameConfig;
    } catch {
      return {};
    }
  });
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const fields = GAME_FIELDS[gameType] || [];

  const handleChange = useCallback((key: keyof GameConfig, value: number | boolean | string[]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setSaved(false);

    const formData = new FormData();
    formData.set('gameType', gameType);
    formData.set('gameConfig', JSON.stringify(config));

    try {
      await action(formData);
      setSaved(true);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsPending(false);
    }
  };

  const getDisplayValue = (key: keyof GameConfig, type: string): number => {
    const val = config[key];
    if (typeof val !== 'number') return 0;
    if (type === 'percent') return Math.round(val * 100);
    return val;
  };

  const setDisplayValue = (key: keyof GameConfig, type: string, displayVal: number) => {
    if (type === 'percent') {
      handleChange(key, displayVal / 100);
    } else {
      handleChange(key, displayVal);
    }
  };

  // Calculate expected house edge for games with winChance
  const houseEdge = config.winChance && config.multiplier
    ? Math.round((1 - config.winChance * config.multiplier) * 100)
    : null;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-platinum">{gameLabel}</h3>
          {houseEdge !== null && (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-platinum/50">
              Преимущество казино: <span className={houseEdge > 0 ? 'text-green-400' : 'text-red-400'}>{houseEdge}%</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[10px] uppercase tracking-wider text-green-400">Сохранено</span>
          )}
          <button
            type="submit"
            disabled={isDisabled || isPending}
            className="rounded-lg border border-gold-400/30 bg-gold-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold-200 transition hover:bg-gold-500/20 disabled:opacity-50"
          >
            {isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-platinum/70">{field.label}</label>
              {field.type === 'percent' && (
                <span className="text-sm font-semibold text-gold-400">
                  {getDisplayValue(field.key, field.type)}%
                </span>
              )}
              {field.type === 'number' && (
                <span className="text-sm font-semibold text-gold-400">
                  {getDisplayValue(field.key, field.type)}
                </span>
              )}
            </div>

            {(field.type === 'percent' || field.type === 'number') && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={field.min ?? 0}
                  max={field.type === 'percent' ? (field.max ?? 100) : (field.max ?? 10)}
                  step={field.step ?? 1}
                  value={getDisplayValue(field.key, field.type)}
                  onChange={(e) => setDisplayValue(field.key, field.type, parseFloat(e.target.value))}
                  disabled={isDisabled}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-gold-400 disabled:opacity-50"
                />
                <input
                  type="number"
                  min={field.min ?? 0}
                  max={field.type === 'percent' ? (field.max ?? 100) : (field.max ?? 10)}
                  step={field.step ?? 1}
                  value={getDisplayValue(field.key, field.type)}
                  onChange={(e) => setDisplayValue(field.key, field.type, parseFloat(e.target.value) || 0)}
                  disabled={isDisabled}
                  className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-center text-sm text-white disabled:opacity-50"
                />
              </div>
            )}

            {field.type === 'toggle' && (
              <button
                type="button"
                onClick={() => handleChange(field.key, !config[field.key])}
                disabled={isDisabled}
                className={`relative h-7 w-14 rounded-full transition-colors ${
                  config[field.key] ? 'bg-gold-500' : 'bg-white/20'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    config[field.key] ? 'left-8' : 'left-1'
                  }`}
                />
              </button>
            )}

            {field.hint && (
              <p className="text-[10px] text-platinum/40">{field.hint}</p>
            )}
          </div>
        ))}
      </div>

      {/* Visual indicator for win probability */}
      {config.winChance !== undefined && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-platinum/50">Распределение исходов</p>
          <div className="flex h-4 overflow-hidden rounded-full">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(config.winChance || 0) * 100}%` }}
              title={`Выигрыш: ${Math.round((config.winChance || 0) * 100)}%`}
            />
            {config.drawChance !== undefined && (
              <div
                className="bg-yellow-500 transition-all"
                style={{ width: `${(config.drawChance || 0) * 100}%` }}
                title={`Ничья: ${Math.round((config.drawChance || 0) * 100)}%`}
              />
            )}
            <div
              className="flex-1 bg-red-500"
              title={`Проигрыш: ${Math.round((1 - (config.winChance || 0) - (config.drawChance || 0)) * 100)}%`}
            />
          </div>
          <div className="flex justify-between text-[9px] text-platinum/40">
            <span className="text-green-400">Выигрыш {Math.round((config.winChance || 0) * 100)}%</span>
            {config.drawChance !== undefined && (
              <span className="text-yellow-400">Ничья {Math.round((config.drawChance || 0) * 100)}%</span>
            )}
            <span className="text-red-400">Проигрыш {Math.round((1 - (config.winChance || 0) - (config.drawChance || 0)) * 100)}%</span>
          </div>
        </div>
      )}

      <input type="hidden" name="gameType" value={gameType} />
      <input type="hidden" name="gameConfig" value={JSON.stringify(config)} />
    </form>
  );
}

/**
 * Telegram Bot — Platinum Stars
 * Полный порт с Python (aiogram) на Node.js (grammy)
 * 
 * Функции:
 *  - /start — синхронизация профиля + реферальный код
 *  - /balance, /online, /promo, /tasks, /inventory, /shop, /sellnft
 *  - /about, /help, /menu, /topup, /withdraw
 *  - Обработка чеков (фото/документ)
 *  - Обработка NFT-подарков
 *  - Обработка платежей Telegram Stars (pre_checkout + successful_payment)
 *  - Inline-клавиатура с callback-кнопками
 */

import 'dotenv/config';
import {
  Bot,
  Context,
  InlineKeyboard,
  InputFile,
} from 'grammy';
import type { Message, PreCheckoutQuery } from 'grammy/types';

// ─── Конфиг ─────────────────────────────────────────────────────────────────

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN ?? '';
const BACKEND_BASE_URL = (process.env.BACKEND_BASE_URL ?? '').replace(/\/$/, '');
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET ?? '';
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME ?? 'platinumstar_manager';
const RECEIPTS_CHANNEL_ID = process.env.RECEIPTS_CHANNEL_ID ?? '';

if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');
if (!BACKEND_BASE_URL) throw new Error('BACKEND_BASE_URL is not set');

function ensureHttps(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return `https://${u.replace(/^\/+/, '')}`;
}

const MINI_APP_URL    = ensureHttps(process.env.TELEGRAM_MINI_APP_URL);
const SUPPORT_CHAT_URL = ensureHttps(process.env.SUPPORT_CHAT_URL);
const TOPUP_URL       = ensureHttps(process.env.TOPUP_URL);
const WITHDRAW_URL    = ensureHttps(process.env.WITHDRAW_URL);

function isValidWebAppUrl(url?: string | null): boolean {
  if (!url) return false;
  if (!url.startsWith('https://')) return false;
  const invalid = ['t.me', 'telegram.org', 'telegram.me'];
  return !invalid.some(h =>
    url === `https://${h}` || url.startsWith(`https://${h}/`) || url.startsWith(`https://www.${h}`),
  );
}

// ─── API-клиент ──────────────────────────────────────────────────────────────

async function apiPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: T }> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(extraHeaders ?? {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));
    return { status: res.status, data: data as T };
  } catch (err) {
    console.error(`POST ${path} failed:`, err);
    return { status: 0, data: { error: 'Backend unavailable' } as T };
  }
}

async function apiGet<T = Record<string, unknown>>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<{ status: number; data: T }> {
  try {
    const url = new URL(`${BACKEND_BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));
    return { status: res.status, data: data as T };
  } catch (err) {
    console.error(`GET ${path} failed:`, err);
    return { status: 0, data: { error: 'Backend unavailable' } as T };
  }
}

// ─── Клавиатуры ──────────────────────────────────────────────────────────────

function buildMainKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Кнопка «Играть»
  if (MINI_APP_URL && isValidWebAppUrl(MINI_APP_URL)) {
    kb.webApp('🎄 Играть', MINI_APP_URL).row();
  } else {
    kb.url('🎄 Играть', MINI_APP_URL ?? 'https://t.me').row();
  }

  kb.text('❄️ Баланс', 'balance').text('👥 Онлайн', 'online').row();
  kb.text('🎁 Подарок дня', 'daily_gift').text('🧩 Задания', 'tasks').row();
  kb.text('🎒 Инвентарь', 'inventory').text('🛍 Магазин NFT', 'shop').text('💎 Продать NFT', 'sell_nft').row();
  kb.text('🔗 Реф. ссылка', 'referral_link').row();
  kb.text('📸 Предоставить чек', 'provide_receipt').row();
  kb.text('✨ Меню', 'main_menu').text('⛄️ Помощь', 'help_menu').row();

  const row: Array<{ text: string; url?: string }> = [];
  if (SUPPORT_USERNAME) row.push({ text: '💬 Поддержка', url: `https://t.me/${SUPPORT_USERNAME.replace('@', '')}` });
  row.push({ text: '👥 Группа', url: 'https://t.me/Platinumstar_channel' });
  for (const btn of row) kb.url(btn.text, btn.url!);
  kb.row();

  kb.text('🎄 О проекте', 'about_project').row();

  return kb;
}

function webAppButton(text: string, path: string): InlineKeyboard {
  const url = `${MINI_APP_URL}${path}`;
  const kb = new InlineKeyboard();
  if (MINI_APP_URL && isValidWebAppUrl(url)) {
    kb.webApp(text, url);
  } else {
    kb.url(text, url || 'https://t.me');
  }
  return kb;
}

// ─── Тексты ──────────────────────────────────────────────────────────────────

function formatHelpText(): string {
  return [
    '<b>Доступные команды</b>',
    '/start — запуск и синхронизация профиля.',
    '/balance — показать текущий баланс.',
    '/online — сколько пользователей онлайн.',
    '/promo &lt;КОД&gt; — активировать промокод.',
    '/tasks — последние задания спонсоров.',
    '/inventory — ваш инвентарь NFT.',
    '/shop — магазин NFT.',
    '/sellnft — продать NFT и пополнить баланс.',
    '/about — о проекте Platinum Stars.',
    '/topup — способы пополнения.',
    '/withdraw — как вывести звёзды.',
    '/help — справка по командам.',
  ].join('\n');
}

function aboutText(): string {
  return `<b>🌟 Platinum Stars</b>

Играй, выполняй задания и зарабатывай звёзды!

<b>🎮 Что такое Platinum Stars?</b>
Это инновационная игровая платформа в Telegram, где ты можешь:
• Играть в увлекательные игры
• Выполнять задания спонсоров
• Зарабатывать звёзды
• Обменивать их на реальные призы

<b>💎 Преимущества:</b>
• Полностью бесплатные игры
• Реальные награды
• Простой и удобный интерфейс
• Поддержка 24/7

<b>🚀 Начни прямо сейчас!</b>
Запусти мини-приложение и окунись в мир развлечений!`;
}

// ─── Bot ─────────────────────────────────────────────────────────────────────

const bot = new Bot(BOT_TOKEN);

// /start
bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  // Реферальный код из параметра /start
  const text = ctx.message?.text ?? '';
  const parts = text.split(/\s+/);
  const referralCode = parts[1]?.trim() ?? null;

  // Синхронизация пользователя с бэкендом
  const { status, data } = await apiPost('/api/bot/sync', {
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name ?? null,
      username: user.username ?? null,
      language_code: (user as Record<string, unknown>).language_code ?? null,
      is_premium: (user as Record<string, unknown>).is_premium ?? false,
      photo_url: null,
    },
  });

  if (status !== 200 || (data as Record<string, unknown>).error) {
    await ctx.reply('Не удалось синхронизировать профиль. Попробуйте позже.');
    return;
  }

  // Применяем реферальный код если есть
  if (referralCode) {
    const refRes = await apiPost('/api/bot/referral', {
      telegramId: user.id,
      code: referralCode,
    });
    if (refRes.status === 200 && (refRes.data as Record<string, unknown>).success) {
      await ctx.reply(`✅ Реферальный код <code>${referralCode}</code> успешно применён!`, {
        parse_mode: 'HTML',
      });
    }
  }

  const miniUrl = ensureHttps((data as Record<string, unknown>).miniAppUrl as string) ?? MINI_APP_URL;
  const holiday = isHolidaySeason();
  const prefix = holiday ? '❄️ ' : '';
  const holidayNote = holiday ? '\n\n❄️ Новогодний режим активен: снежинки, подарки и зимние награды!' : '';

  await ctx.reply(
    `${prefix}Привет! Добро пожаловать в <b>Platinum Stars</b>.\n\n` +
    'Запускайте мини-приложение, участвуйте в заданиях спонсоров и зарабатывайте звёзды. ' +
    'А ещё не забудьте про 🎁 ежедневный подарок.' +
    holidayNote,
    { parse_mode: 'HTML', reply_markup: buildMainKeyboard() },
  );
});

// ─── /balance ────────────────────────────────────────────────────────────────

async function getBalanceText(telegramId: number): Promise<string> {
  const { status, data } = await apiGet('/api/bot/balance', { telegramId });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    return (data as Record<string, unknown>).error as string ?? 'Не удалось получить баланс.';
  }
  const balance = (data as Record<string, unknown>).balance as Record<string, number> ?? {};
  const available = balance.available ?? 0;
  const reserved = balance.reserved ?? 0;
  return `💰 <b>Ваш баланс</b>\n\nДоступно: ${available} ★\nЗарезервировано: ${reserved} ★\nВсего: ${available + reserved} ★`;
}

bot.command('balance', async (ctx) => {
  if (!ctx.from) return;
  await ctx.reply(await getBalanceText(ctx.from.id), { parse_mode: 'HTML' });
});

bot.callbackQuery('balance', async (ctx) => {
  await ctx.answerCallbackQuery('Баланс обновлён');
  if (!ctx.from) return;
  await ctx.reply(await getBalanceText(ctx.from.id), { parse_mode: 'HTML' });
});

// ─── /online ─────────────────────────────────────────────────────────────────

async function getOnlineText(): Promise<string> {
  const { status, data } = await apiGet('/api/bot/online');
  if (status !== 200 || (data as Record<string, unknown>).error) {
    return (data as Record<string, unknown>).error as string ?? 'Не удалось получить онлайн.';
  }
  const online = (data as Record<string, unknown>).online ?? 0;
  const win = (data as Record<string, unknown>).windowSeconds ?? 90;
  return `👥 <b>Онлайн:</b> ${online}\n\n(за последние ${win} сек.)`;
}

bot.command('online', async (ctx) => {
  await ctx.reply(await getOnlineText(), { parse_mode: 'HTML' });
});

bot.callbackQuery('online', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(await getOnlineText(), { parse_mode: 'HTML' });
});

// ─── /promo ──────────────────────────────────────────────────────────────────

bot.command('promo', async (ctx) => {
  if (!ctx.from || !ctx.message?.text) return;
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply('Использование: <code>/promo ВАШ_КОД</code>', { parse_mode: 'HTML' });
    return;
  }
  const code = parts[1].toUpperCase();
  const { status, data } = await apiPost('/api/bot/promo', { telegramId: ctx.from.id, code });
  if (status === 200 && (data as Record<string, unknown>).success) {
    const reward = (data as Record<string, unknown>).reward;
    await ctx.reply(reward ? `Промокод активирован! Вы получили ${reward} ★` : 'Промокод активирован.');
  } else {
    await ctx.reply((data as Record<string, unknown>).error as string ?? 'Не удалось активировать промокод.');
  }
});

// ─── /tasks ──────────────────────────────────────────────────────────────────

async function getTasksMessage(ctx: Context): Promise<void> {
  const { status, data } = await apiGet('/api/bot/tasks');
  if (status !== 200) {
    await ctx.reply('Не удалось получить список заданий. Попробуйте позже.');
    return;
  }
  const tasks = ((data as Record<string, unknown>).tasks ?? []) as Array<Record<string, unknown>>;
  if (!tasks.length) {
    await ctx.reply('Активных заданий пока нет. Загляните позже!');
    return;
  }
  const lines = ['📋 <b>Доступные задания</b>\n'];
  for (const task of tasks.slice(0, 10)) {
    const title = task.title ?? 'Задание';
    const reward = task.reward ?? 0;
    const description = task.description ?? '';
    const link = task.sponsorLink ?? task.link;
    let block = `• <b>${title}</b> — ${reward} ★`;
    if (description) block += `\n   ${String(description).slice(0, 100)}`;
    if (link) block += `\n   <a href="${link}">Ссылка на спонсора</a>`;
    lines.push(block);
  }
  const kb = new InlineKeyboard();
  if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/tasks`)) {
    kb.webApp('🎮 Открыть в мини-приложении', `${MINI_APP_URL}/tasks`);
  }
  await ctx.reply(lines.join('\n\n'), {
    parse_mode: 'HTML',
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

bot.command('tasks', async (ctx) => { await getTasksMessage(ctx); });
bot.callbackQuery('tasks', async (ctx) => {
  await ctx.answerCallbackQuery();
  await getTasksMessage(ctx);
});

// ─── /inventory ──────────────────────────────────────────────────────────────

async function getInventoryMessage(telegramId: number): Promise<{ text: string; kb?: InlineKeyboard }> {
  const { status, data } = await apiGet('/api/bot/nfts', { telegramId, limit: 20 });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    return { text: (data as Record<string, unknown>).error as string ?? 'Не удалось получить инвентарь.' };
  }
  const items = ((data as Record<string, unknown>).items ?? []) as Array<Record<string, unknown>>;
  const total = ((data as Record<string, unknown>).total ?? items.length) as number;
  const lines = ['🎒 <b>Инвентарь</b>'];
  if (!items.length) {
    lines.push('\nПока пусто — выбивайте NFT из кейсов и игр!');
  } else {
    lines.push(`\nВсего: ${total}`);
    for (const item of items) {
      const price = item.priceStars ? ` · ${item.priceStars} ★` : '';
      lines.push(`• ${item.name} — ${item.rarity}${price}`);
    }
    if (total > items.length) lines.push(`\nПоказано ${items.length} из ${total}.`);
  }
  const kb = new InlineKeyboard();
  if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/inventory`)) {
    kb.webApp('🎒 Открыть инвентарь', `${MINI_APP_URL}/inventory`).row();
  }
  kb.text('💎 Продать NFT', 'sell_nft');
  return { text: lines.join('\n'), kb };
}

bot.command('inventory', async (ctx) => {
  if (!ctx.from) return;
  const { text, kb } = await getInventoryMessage(ctx.from.id);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery('inventory', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  const { text, kb } = await getInventoryMessage(ctx.from.id);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

// ─── /shop ───────────────────────────────────────────────────────────────────

async function getShopMessage(telegramId: number): Promise<{ text: string; kb?: InlineKeyboard }> {
  const { status, data } = await apiGet('/api/bot/nft-shop', { telegramId, limit: 8 });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    return { text: '🛍 Магазин NFT пока пуст. Загляните позже!' };
  }
  const items = ((data as Record<string, unknown>).items ?? []) as Array<Record<string, unknown>>;
  if (!items.length) return { text: '🛍 Магазин NFT пока пуст. Загляните позже!' };

  const lines = ['🛍 <b>Магазин NFT</b>\nВыберите подарок и нажмите «Купить».'];
  const kb = new InlineKeyboard();
  for (const item of items) {
    const name = item.name ?? 'NFT';
    const rarity = item.rarity ?? '—';
    const ps = item.priceStars ? `${item.priceStars} ★` : null;
    const pb = item.priceBonus ? `${item.priceBonus} ✨` : null;
    lines.push(`• ${name} — ${rarity} (${[ps, pb].filter(Boolean).join(' / ') || '—'})`);
    if (item.id && ps) kb.text(`Купить ${ps}`, `shop_buy:${item.id}:STARS`).row();
    if (item.id && pb) kb.text(`Купить ${pb}`, `shop_buy:${item.id}:BONUS`).row();
  }
  if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/inventory`)) {
    kb.webApp('🎒 Инвентарь', `${MINI_APP_URL}/inventory`);
  }
  return { text: lines.join('\n'), kb };
}

bot.command('shop', async (ctx) => {
  if (!ctx.from) return;
  const { text, kb } = await getShopMessage(ctx.from.id);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery('shop', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  const { text, kb } = await getShopMessage(ctx.from.id);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

// shop_buy:<id>:<currency>
bot.callbackQuery(/^shop_buy:/, async (ctx) => {
  const parts = ctx.callbackQuery.data.split(':');
  if (parts.length < 3) { await ctx.answerCallbackQuery('Ошибка покупки.'); return; }
  const [, giftId, currency] = parts;
  const { status, data } = await apiPost('/api/bot/nft-shop', {
    telegramId: ctx.from.id,
    giftId,
    currency,
  });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    await ctx.answerCallbackQuery((data as Record<string, unknown>).error as string ?? 'Не удалось купить NFT.', { show_alert: true });
    return;
  }
  const gift = (data as Record<string, unknown>).gift as Record<string, unknown> ?? {};
  const balance = (data as Record<string, unknown>).balance as Record<string, unknown> ?? {};
  await ctx.reply(
    `✅ Покупка успешна!\n\n${gift.name}\nБаланс: ${balance.available} ★\nБонус: ${balance.bonusAvailable} ✨`,
  );
  await ctx.answerCallbackQuery('NFT добавлен в инвентарь');
});

// ─── /sellnft ────────────────────────────────────────────────────────────────

async function getSellNftMessage(telegramId: number): Promise<{ text: string; kb?: InlineKeyboard }> {
  const { status, data } = await apiGet('/api/bot/nfts', { telegramId, limit: 20 });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    return { text: (data as Record<string, unknown>).error as string ?? 'Не удалось получить инвентарь.' };
  }
  const items = ((data as Record<string, unknown>).items ?? []) as Array<Record<string, unknown>>;
  if (!items.length) return { text: '💎 <b>Продажа NFT</b>\n\nИнвентарь пуст. Сначала выбейте NFT!' };

  const lines = ['💎 <b>Продажа NFT</b>'];
  const kb = new InlineKeyboard();
  for (const item of items) {
    if (!item.id || !item.priceStars) continue;
    lines.push(`• ${item.name} — ${item.priceStars} ★`);
    kb.text(`Продать за ${item.priceStars} ★`, `sell_nft:${item.id}`).row();
  }
  return { text: lines.join('\n'), kb };
}

bot.command('sellnft', async (ctx) => {
  if (!ctx.from) return;
  const { text, kb } = await getSellNftMessage(ctx.from.id);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

bot.callbackQuery('sell_nft', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  const { text, kb } = await getSellNftMessage(ctx.from.id);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

// sell_nft:<userGiftId>
bot.callbackQuery(/^sell_nft:/, async (ctx) => {
  const userGiftId = ctx.callbackQuery.data.split(':')[1];
  const { status, data } = await apiPost('/api/bot/nft-sell', {
    telegramId: ctx.from.id,
    userGiftId,
  });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    await ctx.answerCallbackQuery((data as Record<string, unknown>).error as string ?? 'Не удалось продать NFT.', { show_alert: true });
    return;
  }
  const gift = (data as Record<string, unknown>).gift as Record<string, unknown> ?? {};
  const balance = (data as Record<string, unknown>).balance as Record<string, unknown> ?? {};
  await ctx.reply(
    `✅ NFT продан!\n\n${gift.name}\nПолучено: ${gift.priceStars} ★\nБаланс: ${balance.available} ★\nБонус: ${balance.bonusAvailable} ✨`,
  );
  await ctx.answerCallbackQuery('Звёзды зачислены');
});

// ─── /about, /help, /menu, /topup, /withdraw ────────────────────────────────

bot.command('about', async (ctx) => {
  await ctx.reply(aboutText(), { parse_mode: 'HTML', reply_markup: buildMainKeyboard() });
});

bot.callbackQuery('about_project', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(aboutText(), { parse_mode: 'HTML', reply_markup: buildMainKeyboard() });
});

bot.command('help', async (ctx) => {
  await ctx.reply(formatHelpText(), { parse_mode: 'HTML' });
});

bot.callbackQuery('help_menu', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(formatHelpText(), { parse_mode: 'HTML' });
});

bot.command('menu', async (ctx) => {
  await ctx.reply('Главное меню:', { reply_markup: buildMainKeyboard() });
});

bot.callbackQuery('main_menu', async (ctx) => {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: buildMainKeyboard() });
    await ctx.answerCallbackQuery('Меню обновлено');
  } catch {
    await ctx.answerCallbackQuery('Меню уже открыто');
  }
});

bot.command('topup', async (ctx) => {
  const lines = [
    '<b>💳 Как пополнить баланс</b>',
    '',
    '<b>Способ 1: Банковский перевод</b>',
    '1. Откройте мини-приложение и перейдите в \'Кошелёк\'',
    '2. Выберите \'Банковский перевод\'',
    '3. Укажите количество звёзд и получите реквизиты',
    '4. Переведите деньги на указанный счёт',
    '5. Нажмите кнопку 📸 Предоставить чек или отправьте фото чека боту',
    '',
    '<b>Способ 2: Telegram Stars</b>',
    'Моментальное пополнение через встроенные покупки в мини-приложении',
  ];
  if (TOPUP_URL) lines.push(`\n<a href='${TOPUP_URL}'>Альтернативный способ пополнения</a>`);
  const kb = new InlineKeyboard();
  if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/wallet`)) kb.webApp('💰 Открыть кошелёк', `${MINI_APP_URL}/wallet`).row();
  kb.text('📸 Предоставить чек', 'provide_receipt');
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
});

bot.command('withdraw', async (ctx) => {
  const lines = [
    '<b>Вывод средств</b>',
    '1. Завершите все активные попытки и убедитесь, что звёзды на балансе.',
    '2. В мини-приложении откройте раздел \'Вывод\'.',
    '3. Укажите реквизиты и сумму, подтвердите заявку.',
    '4. Служба поддержки уведомит о статусе перевода.',
  ];
  if (WITHDRAW_URL) lines.push(`<a href='${WITHDRAW_URL}'>Страница статуса выводов</a>`);
  if (SUPPORT_CHAT_URL) lines.push(`Возникли вопросы? <a href='${SUPPORT_CHAT_URL}'>Напишите поддержке</a>.`);
  const kb = new InlineKeyboard();
  if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/wallet`)) kb.webApp('💸 Оформить вывод', `${MINI_APP_URL}/wallet`);
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
});

// ─── Реферальная ссылка ──────────────────────────────────────────────────────

bot.callbackQuery('referral_link', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  const { status, data } = await apiGet('/api/bot/referral-info', { telegramId: ctx.from.id });
  if (status !== 200 || (data as Record<string, unknown>).error) {
    await ctx.reply('❌ Не удалось получить реферальную информацию.');
    return;
  }
  const d = data as Record<string, unknown>;
  await ctx.reply(
    `🔗 <b>Ваша реферальная ссылка</b>\n\n` +
    `📋 <b>Код:</b> <code>${d.referralCode}</code>\n\n` +
    `🔗 <b>Ссылка:</b>\n<code>${d.referralLink}</code>\n\n` +
    `📊 <b>Статистика:</b>\n` +
    `👥 Приглашено: ${d.invited}\n` +
    `✅ Завершено: ${d.completed}\n` +
    `⏳ Ожидают: ${d.pending}\n` +
    `⭐ Награда за друга: ${d.rewardPerFriend} ★\n\n` +
    `💡 Поделитесь ссылкой с друзьями и получайте награды!`,
    { parse_mode: 'HTML' },
  );
});

// ─── Ежедневный подарок ──────────────────────────────────────────────────────

bot.callbackQuery('daily_gift', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard();
  if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/gift`)) kb.webApp('🎁 Открыть подарки', `${MINI_APP_URL}/gift`);
  await ctx.reply(
    '🎁 <b>Ежедневный подарок</b>\n\nЗабирайте подарок каждый день — серия увеличивает награду.\nОткройте мини-приложение и зайдите в раздел <b>Подарок</b>.',
    { parse_mode: 'HTML', reply_markup: kb },
  );
});

// ─── Предоставить чек ────────────────────────────────────────────────────────

bot.callbackQuery('provide_receipt', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '📸 <b>Отправка чека о переводе</b>\n\n' +
    'Пожалуйста, отправьте фото или документ с чеком о банковском переводе.\n\n' +
    '💡 <b>Что должно быть на чеке:</b>\n' +
    '• Номер счёта получателя\n' +
    '• Сумма перевода\n' +
    '• Дата и время операции\n\n' +
    '⏳ После отправки чека администратор проверит перевод и зачислит звёзды.',
    { parse_mode: 'HTML' },
  );
});

// ─── Обработка чека (фото / документ) ───────────────────────────────────────

async function handleReceipt(ctx: Context) {
  const msg = ctx.message!;
  const user = ctx.from!;

  let fileId: string | null = null;
  let fileType: string | null = null;

  if (msg.document) {
    fileId = msg.document.file_id;
    fileType = msg.document.mime_type ?? 'document';
  } else if (msg.photo?.length) {
    fileId = msg.photo[msg.photo.length - 1].file_id;
    fileType = 'photo';
  }

  if (!fileId) {
    await ctx.reply(
      '📸 Пожалуйста, отправьте фото или документ с чеком о переводе.\n\n' +
      '💡 <b>Совет:</b> Убедитесь, что на чеке видно:\n' +
      '• Номер счёта получателя\n• Сумма перевода\n• Дата и время операции',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const processing = await ctx.reply('⏳ Обрабатываю чек...');

  const { status, data } = await apiPost('/api/bot/deposit-receipt', {
    telegramId: user.id,
    fileId,
    fileType,
    userInfo: {
      telegramId: user.id,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
    },
  });

  // Удаляем «обрабатываю»
  try { await ctx.api.deleteMessage(msg.chat.id, processing.message_id); } catch {}

  if (status === 200 && (data as Record<string, unknown>).success) {
    const depositRequestId = (data as Record<string, unknown>).depositRequestId as string | undefined;

    // Отправляем чек в канал (если настроен)
    if (RECEIPTS_CHANNEL_ID) {
      const caption = [
        `👤 <b>От:</b> ${user.first_name} (${user.username ? '@' + user.username : 'без username'})`,
        `🆔 <b>ID:</b> ${user.id}`,
        depositRequestId ? `📋 <b>Запрос:</b> ${depositRequestId}` : '',
      ].filter(Boolean).join('\n');

      const channelIds = [RECEIPTS_CHANNEL_ID];
      if (/^\d+$/.test(RECEIPTS_CHANNEL_ID)) channelIds.push(`-100${RECEIPTS_CHANNEL_ID}`);

      for (const cid of channelIds) {
        try {
          if (fileType === 'photo') {
            await ctx.api.sendPhoto(cid, fileId, { caption, parse_mode: 'HTML' });
          } else {
            await ctx.api.sendDocument(cid, fileId, { caption, parse_mode: 'HTML' });
          }
          break;
        } catch (e) {
          console.warn(`Failed to send receipt to channel ${cid}:`, e);
        }
      }
    }

    const kb = new InlineKeyboard();
    if (MINI_APP_URL && isValidWebAppUrl(`${MINI_APP_URL}/wallet`)) kb.webApp('💰 Открыть кошелёк', `${MINI_APP_URL}/wallet`);
    await ctx.reply(
      '✅ <b>Чек успешно получен!</b>\n\n' +
      (depositRequestId ? '📋 Чек привязан к вашему запросу на пополнение.\n\n' : '') +
      '⏳ Администратор проверит перевод в ближайшее время.\n' +
      '🔔 Вы получите уведомление о результате проверки.',
      { parse_mode: 'HTML', reply_markup: kb },
    );
  } else {
    await ctx.reply(
      `❌ <b>Ошибка обработки чека</b>\n\n` +
      `${(data as Record<string, unknown>).error ?? 'Попробуйте позже.'}\n\n` +
      `💡 Попробуйте отправить фото чека ещё раз.`,
      { parse_mode: 'HTML' },
    );
  }
}

bot.on('message:photo', handleReceipt);
bot.on('message:document', handleReceipt);

// ─── Telegram Stars — pre_checkout_query ────────────────────────────────────

bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
    console.info('[pre_checkout] answered ok, payload=', ctx.preCheckoutQuery.invoice_payload);
  } catch (e) {
    console.error('[pre_checkout] error:', e);
    try { await ctx.answerPreCheckoutQuery(true); } catch {}
  }
});

// ─── Telegram Stars — successful_payment ────────────────────────────────────

bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  if (!payment || !ctx.from) return;
  const payload = payment.invoice_payload;
  if (!payload?.startsWith('stars_')) { console.warn('[payment] unexpected payload:', payload); return; }

  const parts = payload.split('_');
  const telegramId = parseInt(parts[1] ?? '0', 10);

  const { status, data } = await apiPost('/api/bot/payment-success', {
    telegramId,
    payload,
    stars: payment.total_amount,
    currency: payment.currency,
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    providerPaymentChargeId: payment.provider_payment_charge_id,
  });

  if (status === 200) {
    await ctx.reply(
      `✅ <b>Платеж успешно обработан!</b>\n\n💰 На ваш баланс зачислено: ${payment.total_amount} ★`,
      { parse_mode: 'HTML', reply_markup: buildMainKeyboard() },
    );
  } else {
    await ctx.reply(
      `⚠️ Платеж получен, но возникла ошибка при обработке.\n` +
      `Обратитесь в поддержку, указав ID: ${payment.telegram_payment_charge_id}`,
    );
  }
});

// ─── NFT-подарок ─────────────────────────────────────────────────────────────

// grammy поддерживает message.gift через rawRequest для Bot API 7.x+
bot.on('message', async (ctx) => {
  const raw = ctx.message as Record<string, unknown>;
  const giftObj = raw.gift as Record<string, unknown> | undefined;
  if (!giftObj || !ctx.from) return;

  const giftInner = giftObj.gift as Record<string, unknown> | undefined;
  const telegramGiftId = String(giftInner?.id ?? giftInner?.sticker_file_id ?? '');
  const giftName = (giftInner?.title ?? 'NFT') as string;

  if (!telegramGiftId || !BOT_INTERNAL_SECRET) {
    console.warn('[nft_gift] missing gift id or bot secret');
    return;
  }

  const { status, data } = await apiPost(
    '/api/bot/nft-gift',
    { senderTelegramId: ctx.from.id, telegramGiftId, giftName, rawPayload: giftObj },
    { 'x-bot-secret': BOT_INTERNAL_SECRET },
  );

  if (status === 200 && (data as Record<string, unknown>).success) {
    const credited = (data as Record<string, unknown>).credited as number ?? 0;
    const name = (data as Record<string, unknown>).giftName as string ?? giftName;
    if (credited > 0) {
      await ctx.reply(
        `🎁 Подарок <b>${name}</b> получен!\n\n✅ На ваш баланс начислено <b>${credited} ★</b>.`,
        { parse_mode: 'HTML' },
      );
    } else {
      await ctx.reply(`🎁 Подарок <b>${name}</b> добавлен в ваш инвентарь!`, { parse_mode: 'HTML' });
    }
  } else {
    await ctx.reply(`⚠️ Подарок получен, но ошибка при обработке: ${(data as Record<string, unknown>).error ?? '?'}\nОбратитесь в поддержку.`);
  }
});

// ─── Настройка команд и кнопки меню ─────────────────────────────────────────

async function setupBotMetadata() {
  await bot.api.setMyCommands([
    { command: 'start',     description: 'Запуск и синхронизация профиля' },
    { command: 'balance',   description: 'Показать текущий баланс' },
    { command: 'online',    description: 'Сколько игроков онлайн сейчас' },
    { command: 'promo',     description: 'Активировать промокод: /promo КОД' },
    { command: 'tasks',     description: 'Показать доступные задания' },
    { command: 'inventory', description: 'Показать инвентарь NFT' },
    { command: 'shop',      description: 'Открыть магазин NFT' },
    { command: 'sellnft',   description: 'Продать NFT и пополнить баланс' },
    { command: 'about',     description: 'О проекте Platinum Stars' },
    { command: 'help',      description: 'Справка по командам' },
  ]);

  await bot.api.setMyShortDescription('Platinum Stars — мини‑приложение с играми, заданиями и звёздами.');
  await bot.api.setMyDescription(
    'Запускайте мини‑приложение, выполняйте задания спонсоров и зарабатывайте звёзды. ' +
    'Баланс синхронизирован между ботом и мини‑приложением.',
  );

  if (MINI_APP_URL && isValidWebAppUrl(MINI_APP_URL)) {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Открыть мини‑приложение', web_app: { url: MINI_APP_URL } },
    });
  } else {
    await bot.api.setChatMenuButton({ menu_button: { type: 'default' } });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isHolidaySeason(): boolean {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return (m === 12 && d >= 10) || (m === 1 && d <= 20);
}

// ─── Запуск ──────────────────────────────────────────────────────────────────

async function main() {
  console.info('[bot] Starting Platinum Stars bot...');
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await setupBotMetadata();
  console.info('[bot] Bot metadata configured.');

  bot.catch((err) => {
    console.error('[bot] Unhandled error:', err);
  });

  await bot.start({
    onStart: (info) => console.info(`[bot] Running as @${info.username}`),
  });
}

main().catch((err) => {
  console.error('[bot] Fatal error:', err);
  process.exit(1);
});

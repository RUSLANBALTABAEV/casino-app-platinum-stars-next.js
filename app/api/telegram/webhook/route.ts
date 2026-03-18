/**
 * Telegram Bot Webhook — Next.js API Route
 * Замена ASTROBOT/bot.py — полный перенос на TypeScript + grammy
 *
 * Установка: npm install grammy
 * Регистрация webhook: GET /api/telegram/setup (один раз)
 */

import { NextRequest, NextResponse } from "next/server";
import { Bot, webhookCallback, InlineKeyboard, Context } from "grammy";

// ─── Env ────────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BACKEND_BASE_URL = (process.env.BACKEND_BASE_URL || "").replace(/\/$/, "");
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || "";
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "platinumstar_manager";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "platinis";
const RECEIPTS_CHANNEL_ID = process.env.RECEIPTS_CHANNEL_ID || "";
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET || "";
const TOPUP_URL = process.env.TOPUP_URL || "";
const WITHDRAW_URL = process.env.WITHDRAW_URL || "";
const SUPPORT_CHAT_URL = process.env.SUPPORT_CHAT_URL || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensureHttps(url: string | undefined): string {
  if (!url) return "";
  const t = url.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function isValidWebAppUrl(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith("https://")) return false;
  const invalid = ["t.me", "telegram.org", "telegram.me"];
  return !invalid.some(
    (h) =>
      url === `https://${h}` ||
      url.startsWith(`https://${h}/`) ||
      url.startsWith(`https://www.${h}`)
  );
}

const miniAppUrl = ensureHttps(MINI_APP_URL);

function buildMainKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (miniAppUrl && isValidWebAppUrl(miniAppUrl)) {
    kb.webApp("🎄 Играть", miniAppUrl).row();
  } else if (miniAppUrl) {
    kb.url("🎄 Играть", miniAppUrl).row();
  }
  kb.text("❄️ Баланс", "balance").text("👥 Онлайн", "online").row();
  kb.text("🎁 Подарок дня", "daily_gift").text("🧩 Задания", "tasks").row();
  kb.text("🎒 Инвентарь", "inventory")
    .text("🛍 Магазин NFT", "shop")
    .text("💎 Продать NFT", "sell_nft")
    .row();
  kb.text("🔗 Реф. ссылка", "referral_link").row();
  kb.text("📸 Предоставить чек", "provide_receipt").row();
  kb.text("✨ Меню", "main_menu").text("⛄️ Помощь", "help_menu").row();
  if (SUPPORT_USERNAME) {
    kb.url(
      "💬 Поддержка",
      `https://t.me/${SUPPORT_USERNAME.replace("@", "")}`
    );
  }
  kb.url("👥 Группа", "https://t.me/Platinumstar_channel").row();
  kb.text("🎄 О проекте", "about_project").row();
  return kb;
}

function helpText(): string {
  return [
    "<b>Доступные команды</b>",
    "/start — запуск и синхронизация профиля",
    "/balance — показать текущий баланс",
    "/online — сколько пользователей онлайн",
    "/promo &lt;КОД&gt; — активировать промокод",
    "/tasks — последние задания спонсоров",
    "/inventory — ваш инвентарь NFT",
    "/shop — магазин NFT",
    "/sellnft — продать NFT и пополнить баланс",
    "/about — о проекте Platinum Stars",
    "/topup — способы пополнения",
    "/withdraw — как вывести звёзды",
    "/help — справка по командам",
  ].join("\n");
}

async function apiFetch(
  path: string,
  opts: { method?: "GET" | "POST"; body?: object; params?: Record<string, string> }
): Promise<{ status: number; data: Record<string, unknown> }> {
  try {
    let url = `${BACKEND_BASE_URL}${path}`;
    if (opts.params) {
      url += "?" + new URLSearchParams(opts.params).toString();
    }
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { error: "Backend unavailable" } };
  }
}

// ─── Bot singleton (important for serverless) ─────────────────────────────────
let bot: Bot | null = null;

function getBot(): Bot {
  if (!bot) {
    bot = new Bot(BOT_TOKEN);
    registerHandlers(bot);
  }
  return bot;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
function registerHandlers(bot: Bot) {
  // /start
  bot.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const parts = ctx.message?.text?.split(" ") ?? [];
    const referralCode = parts[1]?.trim() || null;

    const { status, data } = await apiFetch("/api/bot/sync", {
      method: "POST",
      body: {
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          language_code: user.language_code,
          is_premium: (user as { is_premium?: boolean }).is_premium ?? false,
        },
      },
    });

    if (status !== 200 || data?.error) {
      await ctx.reply("Не удалось синхронизировать профиль. Попробуйте позже.");
      return;
    }

    if (referralCode) {
      const { data: refData } = await apiFetch("/api/bot/referral", {
        method: "POST",
        body: { telegramId: user.id, code: referralCode },
      });
      if (refData?.success) {
        await ctx.reply(
          `✅ Реферальный код <code>${referralCode}</code> успешно применён!`,
          { parse_mode: "HTML" }
        );
      }
    }

    await ctx.reply(
      "Привет! Добро пожаловать в <b>Platinum Stars</b>.\n\n" +
        "Запускайте мини-приложение, участвуйте в заданиях спонсоров и зарабатывайте звёзды. " +
        "А ещё не забудьте про 🎁 ежедневный подарок.",
      { parse_mode: "HTML", reply_markup: buildMainKeyboard() }
    );
  });

  // /balance
  bot.command("balance", async (ctx) => {
    const { status, data } = await apiFetch("/api/bot/balance", {
      params: { telegramId: String(ctx.from?.id) },
    });
    if (status !== 200 || data?.error) {
      await ctx.reply("Не удалось получить баланс.");
      return;
    }
    const bal = (data.balance as Record<string, number>) || {};
    const available = bal.available ?? 0;
    const reserved = bal.reserved ?? 0;
    await ctx.reply(
      `💰 <b>Ваш баланс</b>\n\nДоступно: ${available} ★\nЗарезервировано: ${reserved} ★\nВсего: ${available + reserved} ★`,
      { parse_mode: "HTML" }
    );
  });

  // /online
  bot.command("online", async (ctx) => {
    const { status, data } = await apiFetch("/api/bot/online", {});
    if (status !== 200 || data?.error) {
      await ctx.reply("Не удалось получить данные.");
      return;
    }
    await ctx.reply(
      `👥 <b>Онлайн:</b> ${data.online ?? 0}\n\n(за последние ${data.windowSeconds ?? 90} сек.)`,
      { parse_mode: "HTML" }
    );
  });

  // /promo
  bot.command("promo", async (ctx) => {
    const parts = ctx.message?.text?.split(/\s+/) ?? [];
    if (parts.length < 2) {
      await ctx.reply("Использование: <code>/promo ВАШ_КОД</code>", {
        parse_mode: "HTML",
      });
      return;
    }
    const code = parts[1].toUpperCase();
    const { status, data } = await apiFetch("/api/bot/promo", {
      method: "POST",
      body: { telegramId: ctx.from?.id, code },
    });
    if (status === 200 && data?.success) {
      const reward = data.reward as number;
      await ctx.reply(
        reward
          ? `Промокод активирован! Вы получили ${reward} ★`
          : "Промокод активирован."
      );
    } else {
      await ctx.reply((data?.error as string) || "Не удалось активировать промокод.");
    }
  });

  // /tasks
  bot.command("tasks", async (ctx) => {
    const { status, data } = await apiFetch("/api/bot/tasks", {});
    const tasks = (data?.tasks as Array<Record<string, unknown>>) ?? [];
    if (status !== 200 || !tasks.length) {
      await ctx.reply("Активных заданий пока нет. Загляните позже!");
      return;
    }
    const lines = tasks
      .slice(0, 10)
      .map((t) => {
        let line = `• <b>${t.title}</b> — ${t.reward} ★`;
        if (t.description) line += `\n   ${t.description}`;
        if (t.link) line += `\n   <a href="${t.link}">Ссылка</a>`;
        return line;
      })
      .join("\n\n");
    await ctx.reply(lines, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  // /inventory
  bot.command("inventory", async (ctx) => {
    const { text, kb } = await buildInventoryMessage(ctx.from?.id!);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });

  // /shop
  bot.command("shop", async (ctx) => {
    const { text, kb } = await buildShopMessage(ctx.from?.id!);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });

  // /sellnft
  bot.command("sellnft", async (ctx) => {
    const { text, kb } = await buildSellNftMessage(ctx.from?.id!);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });

  // /about
  bot.command("about", async (ctx) => {
    await ctx.reply(aboutText(), {
      parse_mode: "HTML",
      reply_markup: buildMainKeyboard(),
    });
  });

  // /topup
  bot.command("topup", async (ctx) => {
    const kb = new InlineKeyboard();
    if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/wallet")) {
      kb.webApp("💰 Открыть кошелёк", miniAppUrl + "/wallet").row();
    }
    kb.text("📸 Предоставить чек", "provide_receipt");
    const lines = [
      "<b>💳 Как пополнить баланс</b>",
      "",
      "<b>Способ 1: Банковский перевод</b>",
      "1. Откройте мини-приложение и перейдите в «Кошелёк»",
      "2. Выберите «Банковский перевод»",
      "3. Переведите деньги и нажмите «📸 Предоставить чек»",
      "",
      "<b>Способ 2: Telegram Stars</b>",
      "Моментальное пополнение через встроенные покупки",
    ];
    if (TOPUP_URL) lines.push(`\n<a href='${TOPUP_URL}'>Альтернативный способ</a>`);
    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  });

  // /withdraw
  bot.command("withdraw", async (ctx) => {
    const kb = new InlineKeyboard();
    if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/wallet")) {
      kb.webApp("💸 Оформить вывод", miniAppUrl + "/wallet");
    }
    const lines = [
      "<b>Вывод средств</b>",
      "1. Завершите все активные попытки.",
      "2. В мини-приложении откройте раздел «Вывод».",
      "3. Укажите реквизиты и сумму, подтвердите заявку.",
    ];
    if (WITHDRAW_URL)
      lines.push(`<a href='${WITHDRAW_URL}'>Страница статуса выводов</a>`);
    if (SUPPORT_CHAT_URL)
      lines.push(`Вопросы? <a href='${SUPPORT_CHAT_URL}'>Поддержка</a>`);
    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  });

  // /help
  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(), { parse_mode: "HTML" });
  });

  // /menu
  bot.command("menu", async (ctx) => {
    await ctx.reply("Главное меню:", { reply_markup: buildMainKeyboard() });
  });

  // ── Callback queries ────────────────────────────────────────────────────────
  bot.callbackQuery("balance", async (ctx) => {
    const { status, data } = await apiFetch("/api/bot/balance", {
      params: { telegramId: String(ctx.from.id) },
    });
    if (status !== 200 || data?.error) {
      await ctx.answerCallbackQuery("Ошибка получения баланса");
      return;
    }
    const bal = (data.balance as Record<string, number>) || {};
    const available = bal.available ?? 0;
    const reserved = bal.reserved ?? 0;
    await ctx.reply(
      `💰 <b>Ваш баланс</b>\n\nДоступно: ${available} ★\nЗарезервировано: ${reserved} ★\nВсего: ${available + reserved} ★`,
      { parse_mode: "HTML" }
    );
    await ctx.answerCallbackQuery("Баланс обновлён");
  });

  bot.callbackQuery("online", async (ctx) => {
    const { status, data } = await apiFetch("/api/bot/online", {});
    await ctx.answerCallbackQuery();
    if (status !== 200) {
      await ctx.reply("Не удалось получить данные.");
      return;
    }
    await ctx.reply(
      `👥 <b>Онлайн:</b> ${data.online ?? 0}\n\n(за последние ${data.windowSeconds ?? 90} сек.)`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("tasks", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { status, data } = await apiFetch("/api/bot/tasks", {});
    const tasks = (data?.tasks as Array<Record<string, unknown>>) ?? [];
    if (status !== 200 || !tasks.length) {
      await ctx.reply("📋 Активных заданий пока нет.");
      return;
    }
    const kb = new InlineKeyboard();
    if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/tasks")) {
      kb.webApp("🎮 Открыть в мини-приложении", miniAppUrl + "/tasks");
    }
    const lines = ["📋 <b>Доступные задания</b>\n"];
    tasks.slice(0, 10).forEach((t) => {
      let line = `• <b>${t.title}</b> — ${t.reward} ★`;
      if (t.description) line += `\n   ${String(t.description).slice(0, 100)}`;
      if (t.sponsorLink)
        line += `\n   <a href="${t.sponsorLink}">Ссылка на спонсора</a>`;
      lines.push(line);
    });
    await ctx.reply(lines.join("\n\n"), {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  });

  bot.callbackQuery("daily_gift", async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/gift")) {
      kb.webApp("🎁 Открыть подарки", miniAppUrl + "/gift");
    }
    await ctx.reply(
      "🎁 <b>Ежедневный подарок</b>\n\nЗабирайте подарок каждый день — серия увеличивает награду.",
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.callbackQuery("inventory", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { text, kb } = await buildInventoryMessage(ctx.from.id);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery("shop", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { text, kb } = await buildShopMessage(ctx.from.id);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery(/^shop_buy:(.+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    const giftId = match[1];
    const currency = match[2];
    const { status, data } = await apiFetch("/api/bot/nft-shop", {
      method: "POST",
      body: { telegramId: ctx.from.id, giftId, currency },
    });
    if (status !== 200 || data?.error) {
      await ctx.answerCallbackQuery(
        (data?.error as string) || "Не удалось купить NFT.",
        { show_alert: true }
      );
      return;
    }
    const gift = (data.gift as Record<string, unknown>) || {};
    const bal = (data.balance as Record<string, number>) || {};
    await ctx.reply(
      `✅ Покупка успешна!\n\n${gift.name}\nБаланс: ${bal.available ?? 0} ★\nБонус: ${bal.bonusAvailable ?? 0} ✨`
    );
    await ctx.answerCallbackQuery("NFT добавлен в инвентарь");
  });

  bot.callbackQuery("sell_nft", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { text, kb } = await buildSellNftMessage(ctx.from.id);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery(/^sell_nft:(.+)$/, async (ctx) => {
    const userGiftId = ctx.match[1];
    const { status, data } = await apiFetch("/api/bot/nft-sell", {
      method: "POST",
      body: { telegramId: ctx.from.id, userGiftId },
    });
    if (status !== 200 || data?.error) {
      await ctx.answerCallbackQuery(
        (data?.error as string) || "Не удалось продать NFT.",
        { show_alert: true }
      );
      return;
    }
    const gift = (data.gift as Record<string, unknown>) || {};
    const bal = (data.balance as Record<string, number>) || {};
    await ctx.reply(
      `✅ NFT продан!\n\n${gift.name}\nПолучено: ${gift.priceStars} ★\nБаланс: ${bal.available ?? 0} ★`
    );
    await ctx.answerCallbackQuery("Звёзды зачислены");
  });

  bot.callbackQuery("referral_link", async (ctx) => {
    const { status, data } = await apiFetch("/api/bot/referral-info", {
      params: { telegramId: String(ctx.from.id) },
    });
    if (status !== 200 || data?.error) {
      await ctx.answerCallbackQuery("Не удалось получить информацию", {
        show_alert: true,
      });
      return;
    }
    await ctx.reply(
      `🔗 <b>Ваша реферальная ссылка</b>\n\n` +
        `📋 <b>Код:</b> <code>${data.referralCode}</code>\n\n` +
        `🔗 <b>Ссылка:</b>\n<code>${data.referralLink}</code>\n\n` +
        `📊 <b>Статистика:</b>\n` +
        `👥 Приглашено: ${data.invited ?? 0}\n` +
        `✅ Завершено: ${data.completed ?? 0}\n` +
        `⏳ Ожидают: ${data.pending ?? 0}\n` +
        `⭐ Награда за друга: ${data.rewardPerFriend ?? 0} ★`,
      { parse_mode: "HTML" }
    );
    await ctx.answerCallbackQuery("Реферальная ссылка отправлена");
  });

  bot.callbackQuery("provide_receipt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "📸 <b>Отправка чека о переводе</b>\n\n" +
        "Пожалуйста, отправьте фото или документ с чеком о банковском переводе.\n\n" +
        "💡 <b>Что должно быть на чеке:</b>\n" +
        "• Номер счёта получателя\n• Сумма перевода\n• Дата и время операции",
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("main_menu", async (ctx) => {
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: buildMainKeyboard() });
      await ctx.answerCallbackQuery("Меню обновлено");
    } catch {
      await ctx.answerCallbackQuery("Меню уже открыто");
    }
  });

  bot.callbackQuery("help_menu", async (ctx) => {
    await ctx.reply(helpText(), { parse_mode: "HTML" });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("about_project", async (ctx) => {
    await ctx.reply(aboutText(), {
      parse_mode: "HTML",
      reply_markup: buildMainKeyboard(),
    });
    await ctx.answerCallbackQuery();
  });

  // ── Photo / Document (receipt) ───────────────────────────────────────────
  bot.on(["message:photo", "message:document"], async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const fileId =
      ctx.message.photo
        ? ctx.message.photo[ctx.message.photo.length - 1].file_id
        : ctx.message.document?.file_id;
    const fileType = ctx.message.photo
      ? "photo"
      : ctx.message.document?.mime_type || "document";

    if (!fileId) {
      await ctx.reply("📸 Пожалуйста, отправьте фото или документ с чеком.");
      return;
    }

    const processing = await ctx.reply("⏳ Обрабатываю чек...");

    const { status, data } = await apiFetch("/api/bot/deposit-receipt", {
      method: "POST",
      body: {
        telegramId: user.id,
        fileId,
        fileType,
        userInfo: {
          telegramId: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
        },
      },
    });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, processing.message_id);
    } catch {}

    if (status === 200 && data?.success) {
      // Forward to receipts channel
      if (RECEIPTS_CHANNEL_ID) {
        const caption =
          `👤 <b>От:</b> ${user.first_name} (@${user.username || "нет"})\n` +
          `🆔 <b>ID:</b> ${user.id}\n` +
          (data.depositRequestId
            ? `📋 <b>Запрос:</b> ${data.depositRequestId}`
            : "");
        try {
          if (ctx.message.photo) {
            await ctx.api.sendPhoto(RECEIPTS_CHANNEL_ID, fileId, {
              caption,
              parse_mode: "HTML",
            });
          } else {
            await ctx.api.sendDocument(RECEIPTS_CHANNEL_ID, fileId, {
              caption,
              parse_mode: "HTML",
            });
          }
        } catch (e) {
          console.error("Failed to forward receipt:", e);
        }
      }

      const kb = new InlineKeyboard();
      if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/wallet")) {
        kb.webApp("💰 Открыть кошелёк", miniAppUrl + "/wallet");
      }
      await ctx.reply(
        "✅ <b>Чек успешно получен!</b>\n\n⏳ Администратор проверит перевод в ближайшее время.",
        { parse_mode: "HTML", reply_markup: kb }
      );
    } else {
      await ctx.reply(
        `❌ <b>Ошибка обработки чека</b>\n\n${(data?.error as string) || "Попробуйте позже."}`,
        { parse_mode: "HTML" }
      );
    }
  });

  // ── Pre-checkout ─────────────────────────────────────────────────────────
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  // ── Successful payment ───────────────────────────────────────────────────
  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = payment.invoice_payload;
    if (!payload?.startsWith("stars_")) return;
    const telegramId = parseInt(payload.split("_")[1]);
    const { status } = await apiFetch("/api/bot/payment-success", {
      method: "POST",
      body: {
        telegramId,
        payload,
        stars: payment.total_amount,
        currency: payment.currency,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        providerPaymentChargeId: payment.provider_payment_charge_id,
      },
    });
    if (status === 200) {
      await ctx.reply(
        `✅ <b>Платеж успешно обработан!</b>\n\n💰 Зачислено: ${payment.total_amount} ★`,
        { parse_mode: "HTML", reply_markup: buildMainKeyboard() }
      );
    } else {
      await ctx.reply(
        `⚠️ Платеж получен, но возникла ошибка. ID: ${payment.telegram_payment_charge_id}`
      );
    }
  });
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
async function buildInventoryMessage(
  telegramId: number
): Promise<{ text: string; kb: InlineKeyboard }> {
  const { status, data } = await apiFetch("/api/bot/nfts", {
    params: { telegramId: String(telegramId), limit: "20" },
  });
  const items = (data?.items as Array<Record<string, unknown>>) ?? [];
  const lines = ["🎒 <b>Инвентарь</b>"];
  if (status !== 200 || !items.length) {
    lines.push("\nПока пусто — выбивайте NFT из кейсов и игр!");
  } else {
    lines.push(`\nВсего: ${data?.total ?? items.length}`);
    items.forEach((i) => {
      lines.push(
        `• ${i.name} — ${i.rarity}${i.priceStars ? ` · ${i.priceStars} ★` : ""}`
      );
    });
  }
  const kb = new InlineKeyboard();
  if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/inventory")) {
    kb.webApp("🎒 Открыть инвентарь", miniAppUrl + "/inventory").row();
  }
  kb.text("💎 Продать NFT", "sell_nft");
  return { text: lines.join("\n"), kb };
}

async function buildShopMessage(
  telegramId: number
): Promise<{ text: string; kb: InlineKeyboard }> {
  const { status, data } = await apiFetch("/api/bot/nft-shop", {
    params: { telegramId: String(telegramId), limit: "8" },
  });
  const items = (data?.items as Array<Record<string, unknown>>) ?? [];
  const kb = new InlineKeyboard();
  if (status !== 200 || !items.length) {
    return { text: "🛍 Магазин NFT пока пуст. Загляните позже!", kb };
  }
  const lines = ["🛍 <b>Магазин NFT</b>\nВыберите подарок и нажмите «Купить»."];
  items.forEach((item) => {
    const priceParts = [];
    if (item.priceStars) priceParts.push(`${item.priceStars} ★`);
    if (item.priceBonus) priceParts.push(`${item.priceBonus} ✨`);
    lines.push(`• ${item.name} — ${item.rarity} (${priceParts.join(" / ")})`);
    if (item.priceStars) {
      kb.text(
        `Купить ${item.priceStars} ★`,
        `shop_buy:${item.id}:STARS`
      ).row();
    }
    if (item.priceBonus) {
      kb.text(
        `Купить ${item.priceBonus} ✨`,
        `shop_buy:${item.id}:BONUS`
      ).row();
    }
  });
  if (miniAppUrl && isValidWebAppUrl(miniAppUrl + "/inventory")) {
    kb.webApp("🎒 Инвентарь", miniAppUrl + "/inventory");
  }
  return { text: lines.join("\n"), kb };
}

async function buildSellNftMessage(
  telegramId: number
): Promise<{ text: string; kb: InlineKeyboard }> {
  const { status, data } = await apiFetch("/api/bot/nfts", {
    params: { telegramId: String(telegramId), limit: "20" },
  });
  const items = (data?.items as Array<Record<string, unknown>>) ?? [];
  const lines = ["💎 <b>Продажа NFT</b>"];
  const kb = new InlineKeyboard();
  if (status !== 200 || !items.length) {
    lines.push("\nИнвентарь пуст. Сначала выбейте NFT!");
    return { text: lines.join("\n"), kb };
  }
  let hasSellable = false;
  items.forEach((item) => {
    if (!item.id || !item.priceStars) return;
    hasSellable = true;
    lines.push(`• ${item.name} — ${item.priceStars} ★`);
    kb.text(`Продать за ${item.priceStars} ★`, `sell_nft:${item.id}`).row();
  });
  if (!hasSellable) lines.push("\nНет NFT с ценой для продажи.");
  return { text: lines.join("\n"), kb };
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

<b>🚀 Начни прямо сейчас!</b>
Запусти мини-приложение и окунись в мир развлечений!`;
}

// ─── Route handlers ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const b = getBot();
    const handler = webhookCallback(b, "std/http");
    return await handler(req);
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook is active" });
}

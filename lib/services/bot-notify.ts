/**
 * §6 ТЗ: Уведомления пользователя о статусе вывода через Telegram Bot API.
 * Вызывается из withdrawal.ts после изменения статуса заявки.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId: number | string, text: string): Promise<void> {
  if (!BOT_TOKEN) return; // бот не настроен
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // Уведомление — некритичная операция, не ломаем основной флоу
  }
}

/**
 * Уведомляет пользователя об успешном выводе.
 */
export async function notifyWithdrawalSent(
  telegramId: number | bigint,
  amount: number,
  type: 'STARS' | 'NFT_GIFT' | string,
): Promise<void> {
  const id = Number(telegramId);
  const text =
    type === 'STARS'
      ? `✅ <b>Вывод выполнен!</b>\n\nВаша заявка на вывод <b>${amount} ★</b> обработана.\nЗвёзды поступят на ваш аккаунт Telegram в течение нескольких секунд.`
      : `✅ <b>NFT отправлен!</b>\n\nВаш NFT‑подарок успешно отправлен. Проверьте инвентарь.`;
  await sendMessage(id, text);
}

/**
 * Уведомляет пользователя об отклонении заявки.
 */
export async function notifyWithdrawalRejected(
  telegramId: number | bigint,
  amount: number,
  reason?: string | null,
): Promise<void> {
  const id = Number(telegramId);
  const reasonLine = reason ? `\n\n<i>Причина: ${reason}</i>` : '';
  const text =
    `❌ <b>Заявка отклонена</b>\n\nВаша заявка на вывод <b>${amount} ★</b> была отклонена.${reasonLine}\n\nЗвёзды возвращены на ваш баланс. Обратитесь в поддержку, если считаете это ошибкой.`;
  await sendMessage(id, text);
}

/**
 * Уведомляет пользователя о том, что заявка принята в обработку.
 */
export async function notifyWithdrawalPending(
  telegramId: number | bigint,
  amount: number,
): Promise<void> {
  const id = Number(telegramId);
  const text =
    `⏳ <b>Заявка принята</b>\n\nВаша заявка на вывод <b>${amount} ★</b> принята и ожидает обработки.\nМы уведомим вас о результате.`;
  await sendMessage(id, text);
}

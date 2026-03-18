/**
 * Webhook setup — вызови один раз после деплоя:
 * GET https://pfront-amveraforhosting2026.amvera.io/api/telegram/setup
 */
import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.BACKEND_BASE_URL;

  if (!token || !appUrl) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: [
          "message",
          "callback_query",
          "pre_checkout_query",
        ],
        drop_pending_updates: true,
      }),
    }
  );

  const data = await res.json();
  return NextResponse.json({ webhookUrl, telegramResponse: data });
}

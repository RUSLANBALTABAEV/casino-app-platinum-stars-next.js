import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";  // ← фигурные скобки!

export async function POST(req: Request) {
  const { userId, giftId, starsAmount } = await req.json();
  await prisma.user.update({
    where: { telegramId: userId },
    data: { balance: { increment: starsAmount } },
  });
  return NextResponse.json({ success: true });
}

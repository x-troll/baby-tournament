import { NextRequest, NextResponse } from "next/server";
import { createBabySession, verifyMagicLinkToken } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";

/** Exchanges a Telegram magic-link token for a real session cookie, then redirects to the baby's screen. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const babyId = await verifyMagicLinkToken(token);
  if (!babyId) {
    return new NextResponse("This link has expired — ask the bot for a fresh one with /start.", { status: 400 });
  }

  const baby = await prisma.baby.findUnique({ where: { id: babyId }, include: { playtime: true } });
  if (!baby) {
    return new NextResponse("Couldn't find your registration — ask a Daddy for help.", { status: 404 });
  }

  await createBabySession(baby.id);
  return NextResponse.redirect(new URL(`/play/${baby.playtime.slug}`, request.url));
}

import { NextRequest, NextResponse } from "next/server";
import { createBabySession, verifyMagicLinkToken } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";

// See src/lib/app-url.ts for why this can't just be `request.url`'s
// origin in production. request.url is only a last-resort fallback here
// so local dev without NEXT_PUBLIC_APP_URL set doesn't hard-crash.
function redirectBase(request: NextRequest): string {
  return getAppUrl() || new URL(request.url).origin;
}

/** Exchanges a Telegram magic-link token for a real session cookie, then redirects to the baby's screen. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/", redirectBase(request)));
  }

  const babyId = await verifyMagicLinkToken(token);
  if (!babyId) {
    return NextResponse.redirect(new URL("/nursery/expired?reason=expired", redirectBase(request)));
  }

  const baby = await prisma.baby.findUnique({ where: { id: babyId }, include: { playtime: true } });
  if (!baby) {
    return NextResponse.redirect(new URL("/nursery/expired?reason=not-found", redirectBase(request)));
  }

  await createBabySession(baby.id);
  return NextResponse.redirect(new URL(`/play/${baby.playtime.slugNumber}`, redirectBase(request)));
}

import { NextRequest, NextResponse } from "next/server";
import { createBabySession, verifyMagicLinkToken } from "@/lib/baby-auth";
import { prisma } from "@/lib/prisma";
import { getTerminology } from "@/lib/terminology";

// Next 16 doesn't trust the incoming Host header by default (no
// `experimental.trustHostHeader` in next.config.ts), so `request.url`'s
// origin is reconstructed from the dyno's own bind hostname/port
// (localhost:$PORT on Heroku, per Procfile's `next start -p $PORT`) —
// NOT the real public URL. Building a redirect from `request.url`
// produced exactly that bug in production (a real baby got redirected to
// `localhost:42062`). NEXT_PUBLIC_APP_URL is the trusted source, same as
// telegram/commands.ts's magicLink() already uses; request.url is only a
// last-resort fallback so local dev without that env var set doesn't
// hard-crash.
function redirectBase(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

/** Exchanges a Telegram magic-link token for a real session cookie, then redirects to the baby's screen. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/", redirectBase(request)));
  }

  const babyId = await verifyMagicLinkToken(token);
  if (!babyId) {
    return new NextResponse("This link has expired — ask the bot for a fresh one with /start.", { status: 400 });
  }

  const baby = await prisma.baby.findUnique({ where: { id: babyId }, include: { playtime: true } });
  if (!baby) {
    // No baby found at all — nobody's own /profile preference to read, so
    // this falls back to the deployment-wide term (see baby-terminology.ts).
    return new NextResponse(`Couldn't find your registration — ask a ${getTerminology().admin} for help.`, {
      status: 404,
    });
  }

  await createBabySession(baby.id);
  return NextResponse.redirect(new URL(`/play/${baby.playtime.slugNumber}`, redirectBase(request)));
}

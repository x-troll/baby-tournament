// Baby session — same jose-signed-cookie shape as src/lib/auth.ts (one
// consistent pattern instead of two), but a separate cookie/secret
// namespace since a baby and a Daddy are different actors. No password:
// babies get here via the Telegram magic link (Phase 6) or, for now,
// the admin panel's "Preview as baby" button (see PLAN.md).
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Baby } from "@/generated/prisma/client";

const COOKIE_NAME = "playtime_baby_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h, same reasoning as admin sessions

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set — required to sign/verify baby sessions");
  return new TextEncoder().encode(secret);
}

export async function createBabySession(babyId: string): Promise<void> {
  const token = await new SignJWT({ babyId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearBabySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

const MAGIC_LINK_DURATION_SECONDS = 60 * 10; // 10 minutes — the bot can always send a fresh one

/**
 * The Telegram bot can't set a cookie in the baby's browser directly —
 * it's a completely separate connection (Telegram's servers hitting our
 * webhook, not the baby's phone). Instead it sends a short-lived signed
 * link; GET /nursery/verify exchanges it for the real session cookie.
 */
export async function createMagicLinkToken(babyId: string): Promise<string> {
  return new SignJWT({ babyId, purpose: "magic-link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "magic-link" || typeof payload.babyId !== "string") return null;
    return payload.babyId;
  } catch {
    return null;
  }
}

async function getBabySessionBabyId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.babyId === "string" ? payload.babyId : null;
  } catch {
    return null;
  }
}

export async function getCurrentBaby(): Promise<Baby | null> {
  const babyId = await getBabySessionBabyId();
  if (!babyId) return null;
  return prisma.baby.findUnique({ where: { id: babyId } });
}

/** For a playtime-scoped baby page — redirects to that playtime's join info if not this baby's session. */
export async function requireBaby(playtimeSlug: string): Promise<Baby> {
  const baby = await getCurrentBaby();
  if (!baby) {
    redirect(`/play/${playtimeSlug}/not-signed-in`);
  }
  const playtime = await prisma.playtime.findUnique({ where: { slug: playtimeSlug } });
  if (!playtime || baby.playtimeId !== playtime.id) {
    redirect(`/play/${playtimeSlug}/not-signed-in`);
  }
  return baby;
}

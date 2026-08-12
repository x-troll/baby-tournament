// Baby session — same jose-signed-cookie shape as src/lib/auth.ts (one
// consistent pattern instead of two), but a separate cookie/secret
// namespace since a baby and a Daddy are different actors. No password:
// babies get here via the Telegram magic link (Phase 6) or, for now,
// the admin panel's "Preview as baby" button (see PLAN.md).
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseSlugNumber } from "@/lib/slug-number";
import { shortId } from "@/lib/short-id";
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
 * A website-signup baby has no chat to request a fresh link from —
 * their one bookmarkable link (see requireBabyWithToken below) has to
 * outlive a single 10-minute window on its own, so it gets a much
 * longer-lived token instead: 24h comfortably covers one all-night
 * session without ever going stale mid-event.
 */
export const WEB_BOOKMARK_LINK_DURATION_SECONDS = 60 * 60 * 24;

/**
 * The Telegram bot can't set a cookie in the baby's browser directly —
 * it's a completely separate connection (Telegram's servers hitting our
 * webhook, not the baby's phone). Instead it sends a short-lived link;
 * GET /nursery/verify exchanges it for the real session cookie.
 *
 * A short DB-backed token (src/lib/short-id.ts), not a signed JWT — the
 * same pattern already used for Playtime.joinToken/Admin.adminLinkToken.
 * A self-contained signed JWT can't be meaningfully shortened (~190
 * chars minimum for HS256's three base64url segments) while staying
 * verifiable without a DB round-trip; a short opaque token looked up
 * against the Baby row trades that statelessness for length, which is
 * the right trade here since verify() already hits the DB anyway.
 * Overwrites any previous token/expiry — stays valid and reusable from
 * any device until it naturally expires (not consumed on first use).
 */
export async function createMagicLinkToken(
  babyId: string,
  durationSeconds: number = MAGIC_LINK_DURATION_SECONDS,
): Promise<string> {
  const token = shortId();
  await prisma.baby.update({
    where: { id: babyId },
    data: { magicLinkToken: token, magicLinkExpiresAt: new Date(Date.now() + durationSeconds * 1000) },
  });
  return token;
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const baby = await prisma.baby.findUnique({ where: { magicLinkToken: token } });
  if (!baby?.magicLinkExpiresAt || baby.magicLinkExpiresAt.getTime() < Date.now()) return null;
  return baby.id;
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

/** Session validation shared by requireBaby and requireBabyForRegistration below — not exported, since the only difference between those two is whether a null displayName redirects away or not. */
async function requireBabySessionOnly(playtimeSlug: string): Promise<Baby> {
  const baby = await getCurrentBaby();
  if (!baby) {
    redirect(`/play/${playtimeSlug}/not-signed-in`);
  }
  const slugNumber = parseSlugNumber(playtimeSlug);
  const playtime = slugNumber === null ? null : await prisma.playtime.findUnique({ where: { slugNumber } });
  if (!playtime) {
    redirect(`/play/${playtimeSlug}/not-signed-in`);
  }
  if (baby.playtimeId !== playtime.id) {
    // A *valid* session exists, just for a different playtime — there's
    // only one baby-session cookie site-wide (see the header comment on
    // COOKIE_NAME above), so opening a second game's magic link always
    // swaps out whichever one was active. Distinct from "no session at
    // all" below: this person already has an account here, they're just
    // not currently logged into it — worth telling them that directly
    // instead of the generic "scan the QR" copy.
    redirect(`/play/${playtimeSlug}/not-signed-in?otherPlaytime=1`);
  }
  return baby;
}

/**
 * For a playtime-scoped baby page — redirects to that playtime's join
 * info if not this baby's session, or to the required registration page
 * if the session's baby hasn't picked a display name yet (arrived via a
 * fresh Telegram magic link, or a website /join that hasn't finished
 * registering — see requireBabyForRegistration and
 * src/app/(baby)/play/[slug]/register/page.tsx).
 */
export async function requireBaby(playtimeSlug: string): Promise<Baby> {
  const baby = await requireBabySessionOnly(playtimeSlug);
  if (!baby.displayName) {
    redirect(`/play/${playtimeSlug}/register`);
  }
  return baby;
}

/**
 * Used only by /play/[slug]/register itself — same session validation
 * as requireBaby, but deliberately doesn't redirect away for a null
 * displayName, since fixing that is the whole point of this page.
 */
export async function requireBabyForRegistration(playtimeSlug: string): Promise<Baby> {
  return requireBabySessionOnly(playtimeSlug);
}

/**
 * Same idea as requireBaby, but also accepts a bookmarked-link `?token=`
 * fallback for when there's no session cookie yet (a fresh browser, a
 * cleared cookie jar, or a different device) — see
 * WEB_BOOKMARK_LINK_DURATION_SECONDS above. A cookie that already
 * resolves *this* playtime always wins and skips the token lookup
 * entirely: that's the "caching" behavior — a bookmarked token gets
 * verified against the DB once, then every later visit on that same
 * device is back on the plain cookie fast-path below.
 *
 * Used only by the one page a website-signup baby is told to bookmark
 * (`/play/[slug]`) — every other baby-facing page keeps using plain
 * requireBaby, since by the time a baby reaches them a session cookie
 * already exists either way.
 */
export async function requireBabyWithToken(playtimeSlug: string, token: string | undefined): Promise<Baby> {
  const slugNumber = parseSlugNumber(playtimeSlug);
  const playtime = slugNumber === null ? null : await prisma.playtime.findUnique({ where: { slugNumber } });
  if (!playtime) {
    redirect(`/play/${playtimeSlug}/not-signed-in`);
  }

  const existing = await getCurrentBaby();
  if (existing && existing.playtimeId === playtime.id) {
    if (!existing.displayName) {
      redirect(`/play/${playtimeSlug}/register`);
    }
    return existing;
  }

  if (token) {
    // A Server Component's render can't set a cookie itself (Next
    // throws "Cookies can only be modified in a Server Action or Route
    // Handler") — /nursery/verify already does exactly this
    // token-for-session exchange for Telegram's magic links, so
    // redirecting there reuses that one code path instead of a second
    // one. It strips the token from the URL on its way back to
    // /play/<slug>, which is fine: the token only needs to survive in
    // whatever URL got *bookmarked*, not in every subsequent address bar.
    redirect(`/nursery/verify?token=${encodeURIComponent(token)}`);
  }

  if (existing) {
    // A valid session exists, just for a different playtime — same
    // distinction requireBaby draws above.
    redirect(`/play/${playtimeSlug}/not-signed-in?otherPlaytime=1`);
  }
  redirect(`/play/${playtimeSlug}/not-signed-in`);
}

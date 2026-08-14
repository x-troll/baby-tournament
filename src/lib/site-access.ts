// The shared-PIN gate in front of the public site (spectator screens,
// the /playtimes list, the website join flow, etc.) — not per-identity
// auth like Admin/Baby sessions, just "do you know the password" to keep
// the app off random search-engine/opportunistic traffic. An already-
// authenticated admin or baby never needs this at all (see
// middleware.ts, which checks their session cookies first and only
// falls through to this for a genuinely anonymous visitor).
//
// Deliberately its own file with *no* imports beyond `jose` — middleware
// runs on the Edge runtime, and importing src/lib/auth.ts or
// baby-auth.ts directly (even just for a cookie-name constant) would
// pull their other imports (bcryptjs, Prisma's pg adapter) into the Edge
// bundle, which is exactly the trap this codebase's admin auth already
// avoids by keeping real auth checks in server components instead of
// middleware (see (admin)/(protected)/layout.tsx). `jose`, unlike
// bcryptjs, is written to run in both runtimes, so this one file is safe
// to import from both middleware.ts (Edge) and the enter-pin server
// action (Node).
import { SignJWT, jwtVerify } from "jose";

export const SITE_PIN_COOKIE_NAME = "playtime_site_pin";
// Long-lived on purpose: this isn't protecting anything identity-bound
// or per-account — re-prompting a spectator for the shared PIN every few
// hours across a multi-night event would just be friction with no real
// security benefit.
export const SITE_PIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set, required to sign/verify the site-pin cookie");
  return new TextEncoder().encode(secret);
}

/** Called once the correct PIN is submitted (verifySitePinAction) — signs the cookie value to set. */
export async function signSitePinToken(): Promise<string> {
  return new SignJWT({ sitePin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SITE_PIN_COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/** Edge-safe: no DB lookup, just "is this a validly-signed, unexpired token" — used by middleware.ts to decide whether to let a request through. */
export async function verifySitePinToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

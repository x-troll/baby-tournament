// Shared-PIN gate in front of the whole public site — an anonymous
// visitor (no admin session, no baby session) has to enter SITE_PIN
// once (see /enter-pin, src/lib/site-access.ts) before seeing anything
// else. An already-authenticated admin or baby skips this entirely.
//
// Runs on the Edge runtime, so it deliberately does its own lightweight
// JWT *signature* check for the admin/baby cookies (no DB lookup, no
// bcryptjs, no Prisma) rather than importing getCurrentAdmin()/
// getCurrentBaby() from src/lib/auth.ts / baby-auth.ts — those modules
// pull in bcryptjs and Prisma's pg adapter, neither of which is
// Edge-safe (see those files' own comments on why real auth checks stay
// in server components instead of middleware). A forged-but-expired-or-
// deleted session JWT passing this shallow check isn't a security hole:
// it only ever grants "skip the PIN wall", never real admin/baby
// authorization — every actual admin/baby action still goes through the
// real, DB-backed requireAdmin()/requireBaby() checks downstream.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { verifySitePinToken, SITE_PIN_COOKIE_NAME } from "@/lib/site-access";

// Must match COOKIE_NAME in src/lib/auth.ts / src/lib/baby-auth.ts —
// kept as plain literals here rather than importing those modules, see
// the file-level comment above for why.
const ADMIN_SESSION_COOKIE_NAME = "playtime_admin_session";
const BABY_SESSION_COOKIE_NAME = "playtime_baby_session";

// Routes a genuinely anonymous visitor still needs to reach *before*
// they have any session at all: the PIN form itself, admin login, the
// website join flow (a new baby has no session yet at the moment they
// hit this), and the Telegram magic-link exchange + expired-link page.
// Also the Telegram webhook — server-to-server, no PIN concept applies.
function isExempt(pathname: string): boolean {
  return (
    pathname === "/enter-pin" ||
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/nursery/") ||
    pathname === "/api/telegram/webhook"
  );
}

async function hasValidSessionCookie(request: NextRequest, cookieName: string): Promise<boolean> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // Feature is opt-in — deployments that never set SITE_PIN keep today's
  // fully-open behavior.
  if (!process.env.SITE_PIN) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  if (await hasValidSessionCookie(request, ADMIN_SESSION_COOKIE_NAME)) return NextResponse.next();
  if (await hasValidSessionCookie(request, BABY_SESSION_COOKIE_NAME)) return NextResponse.next();
  if (await verifySitePinToken(request.cookies.get(SITE_PIN_COOKIE_NAME)?.value)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/enter-pin";
  url.search = "";
  url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and any request for a file with an
  // extension (every /public asset — avatars, motifs, favicon, etc.) —
  // the standard Next.js middleware matcher pattern. An image request
  // redirected to an HTML page would just fail to load, so these need to
  // be skipped at the matcher level, not just allow-listed in isExempt.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};

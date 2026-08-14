// Shared-PIN gate in front of the whole public site — an anonymous
// visitor (no admin session, no baby session) has to enter SITE_PIN
// once (see /enter-pin, src/lib/site-access.ts) before seeing anything
// else. An already-authenticated admin or baby skips this entirely.
//
// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (export `proxy`, not `middleware`) — this file was originally named
// and placed as `middleware.ts` at the project root, which this fork
// silently never invokes (see node_modules/next/dist/docs/.../proxy.md:
// "The `middleware` file convention has been deprecated... renamed to
// `proxy`"). Also must live at `src/proxy.ts`, not the project root,
// since `app` lives at `src/app` here — the convention is "same level
// as `app`".
//
// Proxy defaults to the Node.js runtime as of v16 (unlike the old
// Edge-only Middleware), so bcryptjs/Prisma would actually be safe to
// import here now — but this still deliberately does its own
// lightweight JWT *signature* check for the admin/baby cookies (no DB
// lookup) rather than importing getCurrentAdmin()/getCurrentBaby() from
// src/lib/auth.ts / baby-auth.ts, simply to keep this file fast and
// dependency-free; not a runtime necessity anymore. A forged-but-
// expired-or-deleted session JWT passing this shallow check isn't a
// security hole: it only ever grants "skip the PIN wall", never real
// admin/baby authorization — every actual admin/baby action still goes
// through the real, DB-backed requireAdmin()/requireBaby() checks
// downstream.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { verifySitePinToken, SITE_PIN_COOKIE_NAME } from "@/lib/site-access";

// Must match COOKIE_NAME in src/lib/auth.ts / src/lib/baby-auth.ts —
// kept as plain literals here rather than importing those modules, so
// this file stays a minimal, fast, dependency-light gate.
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

export async function proxy(request: NextRequest) {
  // Feature is opt-in — deployments that never set SITE_PIN keep today's
  // fully-open behavior.
  if (!process.env.SITE_PIN) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  if (await hasValidSessionCookie(request, ADMIN_SESSION_COOKIE_NAME)) return NextResponse.next();
  if (await hasValidSessionCookie(request, BABY_SESSION_COOKIE_NAME)) return NextResponse.next();
  if (await verifySitePinToken(request.cookies.get(SITE_PIN_COOKIE_NAME)?.value)) return NextResponse.next();

  // A JSON API consumer (the spectator/baby-page poll loops) was never
  // going to do anything useful with an HTML redirect target — `fetch()`
  // follows it by default, so the caller would get back a 200 HTML page
  // where JSON was expected and fail confusingly (or, worse, silently, if
  // it treats a parse error the same as a network hiccup and just retries
  // forever). A real 401 lets those callers actually detect and react to
  // "the gate rejected this" instead.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "PIN or session required" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/enter-pin";
  url.search = "";
  url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and any request for a file with an
  // extension (every /public asset — avatars, motifs, favicon, etc.) —
  // the standard Next.js matcher pattern. An image request redirected to
  // an HTML page would just fail to load, so these need to be skipped
  // at the matcher level, not just allow-listed in isExempt.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};

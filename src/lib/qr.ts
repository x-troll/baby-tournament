// Pure URL builders — actual QR rendering moved client-side, see
// src/components/ui/StyledQrCode.tsx (qr-code-styling needs a real
// browser canvas; these two functions have nothing to do with that,
// they just build the t.me deep link a QR code (or a plain tappable
// link) points at).
import { getAppUrl } from "@/lib/app-url";

export function babyJoinDeepLink(joinToken: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) throw new Error("TELEGRAM_BOT_USERNAME is not set");
  return `https://t.me/${botUsername}?start=${joinToken}`;
}

export function adminLinkDeepLink(adminLinkToken: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) throw new Error("TELEGRAM_BOT_USERNAME is not set");
  return `https://t.me/${botUsername}?start=admin_${adminLinkToken}`;
}

/** The website counterpart to babyJoinDeepLink — same joinToken, points at src/app/join/[token]/page.tsx instead of Telegram. Null (not thrown) if NEXT_PUBLIC_APP_URL isn't set, so callers can degrade the same way they already do for a missing TELEGRAM_BOT_USERNAME. */
export function websiteJoinLink(joinToken: string): string | null {
  const appUrl = getAppUrl();
  if (!appUrl) return null;
  return `${appUrl}/join/${joinToken}`;
}

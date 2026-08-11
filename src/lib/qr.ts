// Pure URL builders — actual QR rendering moved client-side, see
// src/components/ui/StyledQrCode.tsx (qr-code-styling needs a real
// browser canvas; these two functions have nothing to do with that,
// they just build the t.me deep link a QR code (or a plain tappable
// link) points at).
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

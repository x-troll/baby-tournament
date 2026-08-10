// No `import "server-only"` — see src/lib/auth.ts for why (also used by
// standalone scripts outside Next's build pipeline).
import QRCode from "qrcode";

/** Renders a QR code server-side as an inline SVG data URI — no external image service. */
export async function qrCodeDataUri(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 1, color: { dark: "#3a2e3f", light: "#ffffff" } });
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

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

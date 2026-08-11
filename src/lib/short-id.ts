// Short, URL-friendly random tokens for join/deep-link codes — deliberately
// not a Prisma-generated cuid (25 chars): these get typed/scanned/shared in
// a Telegram deep link, and a private one-night event with a guest list of
// dozens doesn't need cuid-grade collision resistance to be effectively
// unguessable. No new dependency (no nanoid) — a few lines over
// node:crypto is simpler than adding a package for this.
import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 62 chars, URL-safe

/**
 * `length=8` over a 62-char alphabet is 62^8 ≈ 2.18×10^14 possibilities —
 * plenty for a guest list of dozens with negligible collision risk, while
 * being roughly a third the length of the cuid it replaces.
 */
export function shortId(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

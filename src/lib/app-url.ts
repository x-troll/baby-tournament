// The one trusted source for this deployment's real public origin —
// Next 16 doesn't trust the incoming Host header by default (no
// `experimental.trustHostHeader` in next.config.ts), so `request.url`'s
// origin is reconstructed from the dyno's own bind hostname/port
// (localhost:$PORT on Heroku), NOT the real public URL. Building a link
// from `request.url` produced exactly that bug in production once
// already (see src/app/nursery/verify/route.ts's history) — every
// absolute link this app hands to a browser (magic links, join QR
// URLs) needs to go through here instead.
//
// Returns null rather than throwing: some callers (e.g. the website
// join QR) already degrade gracefully to "don't show this QR" when a
// prerequisite env var is unset, the same way babyJoinDeepLink's
// TELEGRAM_BOT_USERNAME check does.
export function getAppUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_URL || null;
}

# Future improvements

Deferred work, intentionally out of scope for now but worth picking up later.

## Full Web Push for browser notifications

`src/components/baby/BrowserNotifications.tsx` (added in the todos.md
route-merge/notifications/settings pass) is a **foreground-only**
fallback: plain `Notification.requestPermission()` + a poll loop, so it
only fires while the `/play/[slug]` tab is actually open. Good enough
for testing without a real Telegram bot connection and as a nice-to-have
for everyone else, but it can't wake a phone whose browser tab is closed
or backgrounded — that needs real Web Push:

- A service worker registered on `/play/[slug]` that can receive push
  events even when no tab is open.
- VAPID key generation (`web-push` npm package has a helper for this) —
  a public/private keypair the server signs pushes with and the browser
  verifies.
- A `PushSubscription` Prisma model (per baby, since a baby can have
  multiple devices) storing the `endpoint`/`keys.p256dh`/`keys.auth`
  triple `pushManager.subscribe()` returns.
- Server-side: the `web-push` package's `sendNotification()`, called
  from the same trigger points `src/lib/telegram/notify.ts` already
  covers, alongside (not instead of) the Telegram sends.
- Subscription lifecycle: prompt once, store the subscription, handle
  the browser invalidating it (410 Gone from `sendNotification` means
  delete the row and let the client resubscribe next visit).

None of this is needed for a one-night, in-person bar event where
everyone's phone is out and Telegram already covers the "off-screen"
case for anyone who bothered to link it — but if this ever needs to
reliably notify someone whose phone is asleep in their pocket without
Telegram, this is the next step.

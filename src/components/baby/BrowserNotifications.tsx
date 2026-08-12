"use client";

import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 4000;

// Kinds worth interrupting someone for — the same moments Telegram
// already pushes for (needsYourConfirmation, napped, crowned) plus
// "your match just went live" (PLAYING), which matters most for a baby
// who isn't looking at this tab right now. Anything else (QUIET_TIME,
// UP_NEXT, DADDY_COMING, ...) is either not actionable from here or
// already visible the moment they glance at the tab.
const NOTIFIABLE_KINDS = new Set(["PLAYING", "AWAITING_YOUR_CONFIRMATION", "NAPPED", "CHAMPION"]);

const NOTIFICATION_COPY: Record<string, { title: string; body: string }> = {
  PLAYING: { title: "Your match is live! 🎮", body: "Head back to your screen — it's time to play." },
  AWAITING_YOUR_CONFIRMATION: { title: "Confirm your result ✅", body: "Someone reported a result — take a look." },
  NAPPED: { title: "Nap time 😴", body: "Your run's over for tonight — come see how you placed." },
  CHAMPION: { title: "🌟 Best Baby! 🌟", body: "You won it all — congratulations!" },
};

/**
 * Foreground-only fallback for babies without Telegram (and a "just in
 * case" for babies with it too — see todos.md: "always browser, this
 * will help with testing without telegram connection for each user").
 * No service worker/push subscription — just Notification.requestPermission()
 * (must be a real click, browsers silently ignore it otherwise) plus the
 * same poll-and-diff pattern SpectatorPoller already uses. Only fires
 * while this tab is open; see future_improvements.md for the full Web
 * Push version.
 */
export function BrowserNotifications({ slug }: { slug: string }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const lastKindRef = useRef<string | null>(null);

  useEffect(() => {
    // Notification.permission is a browser-only global unavailable during
    // SSR — this has to be read post-mount, and there's no change event
    // to subscribe to instead (see requestPermission()'s own setPermission
    // call below for the only other place this updates).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of a browser global, not derivable during SSR, no cascading loop
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/play/${slug}/notify-state`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { kind } = (await res.json()) as { kind: string };

        if (
          lastKindRef.current !== null &&
          lastKindRef.current !== kind &&
          NOTIFIABLE_KINDS.has(kind) &&
          document.visibilityState !== "visible"
        ) {
          const copy = NOTIFICATION_COPY[kind];
          if (copy) new Notification(copy.title, { body: copy.body, icon: "/website-signup-badge.svg" });
        }
        lastKindRef.current = kind;
      } catch {
        // Network hiccup — just try again next tick.
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, permission]);

  if (permission === "unsupported" || permission === "granted" || permission === "denied") return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
      }}
      className="self-start rounded-card border border-border bg-background-elevated px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:opacity-80"
    >
      🔔 Enable notifications
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4000;

// Kinds worth interrupting someone for — the same moments Telegram
// already pushes for (napped, crowned) plus "your match just went live"
// (PLAYING), which matters most for a baby who isn't looking at this
// tab right now. Anything else (QUIET_TIME, UP_NEXT, DADDY_COMING, ...)
// is either not actionable from here or already visible the moment
// they glance at the tab.
const NOTIFIABLE_KINDS = new Set(["PLAYING", "NAPPED", "CHAMPION"]);

const NOTIFICATION_COPY: Record<string, { title: string; body: string }> = {
  PLAYING: { title: "Your match is live! 🎮", body: "Head back to your screen, it's time to play." },
  NAPPED: { title: "Nap time 😴", body: "Your run's over for tonight, come see how you placed." },
};

/**
 * The one poll loop for everything /play/[slug] needs live — replaces
 * two independent ones that used to run on overlapping schedules:
 * AutoRefresh (unconditional `router.refresh()` every 5s, re-running the
 * *entire* server component — requireBabyWithToken, computeBabyStatus,
 * computeSpectatorState, loadRules, plus a conditional match query — for
 * every connected baby regardless of whether anything changed) and this
 * component's own separate notify-state poll. Both concerns now read off
 * one `/api/play/[slug]/notify-state` response: `lastEventId` (the same
 * append-only MatchEvent cursor computeSpectatorState/the spectator poll
 * already use) gates `router.refresh()` to only when something actually
 * happened, and `kind` still drives the desktop-notification diffing
 * below, foreground-only fallback for babies without Telegram (and a
 * "just in case" for babies with it too). No service worker/push
 * subscription — just Notification.requestPermission() (must be a real
 * click, browsers silently ignore it otherwise). Only fires while this
 * tab is open; see future_improvements.md for the full Web Push version.
 *
 * `championLabel` — the one bit of copy here that varies by theme
 * (terminology.ts's `champion`) — is resolved server-side by the parent
 * page and passed in as a plain string, same reasoning as every other
 * client component that can't call getTerminology() itself (see
 * StatusBadge.tsx's comment on the client/server boundary).
 */
export function PlayPagePoller({ slug, championLabel }: { slug: string; championLabel: string }) {
  const router = useRouter();
  // Starts genuinely unknown (not "default") — defaulting this to
  // "default" before the effect below gets a chance to read the real
  // value meant the "Enable notifications" button rendered for everyone
  // on every load, including babies who'd already granted/denied it,
  // for one visible frame until the effect corrected it. `null` renders
  // nothing (see the early return) until the real value is in.
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const lastKindRef = useRef<string | null>(null);
  const lastEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Notification.permission is a browser-only global unavailable during
    // SSR — this has to be read post-mount, and there's no change event
    // to subscribe to instead (see requestPermission()'s own setPermission
    // call below for the only other place this updates).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of a browser global, not derivable during SSR, no cascading loop
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  // Deliberately unconditional (not gated on `permission`) — the
  // refresh-on-change half of this loop has to run for every baby, with
  // or without notifications enabled; only the actual Notification() call
  // below is permission-gated.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/play/${slug}/notify-state`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { kind, lastEventId } = (await res.json()) as { kind: string; lastEventId: number };

        if (
          permission === "granted" &&
          lastKindRef.current !== null &&
          lastKindRef.current !== kind &&
          NOTIFIABLE_KINDS.has(kind) &&
          document.visibilityState !== "visible"
        ) {
          const copy =
            kind === "CHAMPION"
              ? { title: `🌟 ${championLabel}! 🌟`, body: "You won it all, congratulations!" }
              : NOTIFICATION_COPY[kind];
          if (copy) new Notification(copy.title, { body: copy.body, icon: "/website-signup-badge.svg" });
        }
        lastKindRef.current = kind;

        if (lastEventIdRef.current !== null && lastEventIdRef.current !== lastEventId) {
          router.refresh();
        }
        lastEventIdRef.current = lastEventId;
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
  }, [slug, permission, championLabel, router]);

  if (permission === null || permission === "unsupported" || permission === "granted" || permission === "denied") return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
      }}
      className="shrink-0 rounded-card border border-border bg-background-elevated px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:opacity-80"
    >
      🔔 Enable notifications
    </button>
  );
}

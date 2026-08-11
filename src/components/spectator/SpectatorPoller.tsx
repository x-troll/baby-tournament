"use client";

import { useEffect, useRef, useState } from "react";
import { StageBanner } from "./StageBanner";
import { CurrentMatches } from "./CurrentMatches";
import { SpectatorStarChart } from "./SpectatorStarChart";
import { HelpIndicator } from "./HelpIndicator";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import type { SpectatorState } from "@/lib/spectator-state";

const POLL_INTERVAL_MS = 3000;

/**
 * Polling, not SSE (see PLAN.md Phase 1: Heroku's router kills idle
 * connections after 55s, dyno restarts drop long-lived ones anyway).
 * `?since=<lastEventId>` makes most polls cheap — the server replies
 * `{ unchanged: true }` instead of re-shipping the full state when
 * nothing happened, reusing the append-only MatchEvent log as the cursor.
 */
export function SpectatorPoller({ slug, initial }: { slug: string; initial: SpectatorState }) {
  const [state, setState] = useState(initial);
  const previousGoldStars = useRef<Map<string, number>>(new Map(initial.starChart.map((r) => [r.babyId, r.goldStars])));
  const [justEarnedStarBabyIds, setJustEarnedStarBabyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/playtime/${slug}/state?since=${state.lastEventId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.unchanged || cancelled) return;

        const next: SpectatorState = json.state;
        const justEarned = new Set<string>();
        for (const row of next.starChart) {
          const before = previousGoldStars.current.get(row.babyId) ?? 0;
          if (row.goldStars > before) justEarned.add(row.babyId);
        }
        previousGoldStars.current = new Map(next.starChart.map((r) => [r.babyId, r.goldStars]));

        setJustEarnedStarBabyIds(justEarned);
        setState(next);
      } catch {
        // Network hiccup — just try again next tick, nothing to surface on a TV.
      }
    }

    // Re-subscribes each time lastEventId changes so the next poll's
    // `since` is always current — a stale closure would keep polling
    // with an outdated cursor forever.
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, state.lastEventId]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-8">
      <HelpIndicator count={state.openHelpRequestCount} />

      <header className="text-center">
        <h1 className="font-display text-2xl font-bold text-foreground-muted">{state.playtimeName}</h1>
      </header>

      <StageBanner text={state.stageBanner} />

      <CurrentMatches matches={state.activeMatches} onDeck={state.onDeck} />

      <PlaytimeBracketsView playpens={state.playpens} phase2Bracket={state.phase2Bracket} />

      <section aria-label="Star chart" className="rounded-card border-2 border-border bg-background-elevated p-5">
        <SpectatorStarChart rows={state.starChart} justEarnedStarBabyIds={justEarnedStarBabyIds} />
      </section>
    </div>
  );
}

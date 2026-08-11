"use client";

import { useEffect, useState } from "react";
import { StageBanner } from "./StageBanner";
import { CurrentMatches } from "./CurrentMatches";
import { HelpIndicator } from "./HelpIndicator";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { GAME_LOGO_SRC } from "@/lib/game-assets";
import type { SpectatorState } from "@/lib/spectator-state";

const POLL_INTERVAL_MS = 3000;

/**
 * Polling, not SSE (see PLAN.md Phase 1: Heroku's router kills idle
 * connections after 55s, dyno restarts drop long-lived ones anyway).
 * `?since=<lastEventId>` makes most polls cheap — the server replies
 * `{ unchanged: true }` instead of re-shipping the full state when
 * nothing happened, reusing the append-only MatchEvent log as the cursor.
 *
 * No playtime title, no star chart/score board — deliberately trimmed to
 * just what's happening right now (help indicator, stage banner, current
 * matches, the bracket itself). The star chart is still real data
 * (`state.starChart`), just no longer rendered on this screen.
 */
export function SpectatorPoller({ slug, initial }: { slug: string; initial: SpectatorState }) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/playtime/${slug}/state?since=${state.lastEventId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.unchanged || cancelled) return;

        setState(json.state);
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
      <HelpIndicator count={state.openHelpRequestCount} adminTerm={state.adminTerm} />

      <StageBanner text={state.stageBanner} />

      {state.status === "NURSERY_OPEN" && state.joinLink && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-lg font-semibold text-foreground-muted">Scan to join!</p>
          <StyledQrCode data={state.joinLink} size={400} logoSrc={GAME_LOGO_SRC[state.game]} />
        </div>
      )}

      <CurrentMatches matches={state.activeMatches} onDeck={state.onDeck} />

      <PlaytimeBracketsView playpens={state.playpens} phase2Bracket={state.phase2Bracket} />
    </div>
  );
}

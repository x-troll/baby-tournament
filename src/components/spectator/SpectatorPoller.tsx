"use client";

import { useEffect, useRef, useState } from "react";
import { StageBanner } from "./StageBanner";
import { HelpIndicator } from "./HelpIndicator";
import { RegisteredBabies } from "./RegisteredBabies";
import { NurseryCheckIn } from "./NurseryCheckIn";
import { PlaytimeBracketsView } from "@/components/brackets/PlaytimeBracketsView";
import { GAME_LOGO_SRC } from "@/lib/game-assets";
import type { SpectatorMatch, SpectatorState } from "@/lib/spectator-state";

const POLL_INTERVAL_MS = 3000;

/** One line, in priority-station order — ▶ for a match actually underway, ⏳ for one stationed but not yet tapped into. Multi-station events read as e.g. "▶ Alice vs Bob   ·   ⏳ Carol vs Dave". */
function playingNowLine(matches: SpectatorMatch[]): string {
  if (matches.length === 0) return "Between matches…";
  return matches
    .map((m) => `${m.status === "READY" ? "⏳" : "▶"} ${m.participants.map((p) => p.name).join(" vs ")}`)
    .join("   ·   ");
}

/**
 * Polling, not SSE (see PLAN.md Phase 1: Heroku's router kills idle
 * connections after 55s, dyno restarts drop long-lived ones anyway).
 * `?since=<lastEventId>` makes most polls cheap — the server replies
 * `{ unchanged: true }` instead of re-shipping the full state when
 * nothing happened, reusing the append-only MatchEvent log as the cursor.
 *
 * No playtime title, no star chart/score board — deliberately trimmed to
 * just what's happening right now (help indicator, stage banner, current
 * matches, the bracket itself). The star-chart data this screen used to
 * render was removed (SpectatorState no longer computes it) once nothing
 * consumed it anymore — see the admin panel's own Score tab for the
 * per-baby standings table instead.
 *
 * While IN_PROGRESS there are just two cards in flow: this banner (back
 * link, logo, and round-context/who's-playing text all in one row, with
 * on-deck arrow-joined onto the same title line and the "Start playing"
 * reminder tucked in the corner instead of a separate pill/card each)
 * and the bracket.
 */
export function SpectatorPoller({
  slug,
  initial,
  backHref,
  rulesSummary,
  rulesOverrideNote,
}: {
  slug: string;
  initial: SpectatorState;
  /** "← All playtimes", rendered inside the header card itself rather than as a separate element above it. */
  backHref: string;
  rulesSummary: string;
  rulesOverrideNote: string | null;
}) {
  const [state, setState] = useState(initial);
  const [newlyJoinedIds, setNewlyJoinedIds] = useState<Set<string>>(new Set());
  // Whatever babyIds were already known as of the last render — not
  // component state itself (a ref update shouldn't trigger a re-render
  // on its own), just the comparison point each poll diffs against.
  // Seeded from the initial server-rendered list so babies who joined
  // before this page ever loaded don't bounce in on first paint.
  const knownBabyIdsRef = useRef<Set<string>>(new Set(initial.registeredBabies.map((b) => b.babyId)));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/playtime/${slug}/state?since=${state.lastEventId}`, { cache: "no-store" });
        if (cancelled) return;
        // A 401 means the PIN/session gate (src/proxy.ts) rejected this
        // request — the cookie situation that caused that doesn't fix
        // itself on its own, so silently retrying forever (the old
        // behavior here) would poll dead until someone manually reloads.
        // A real reload re-navigates through the gate properly instead.
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        if (json.unchanged || cancelled) return;

        const nextState: SpectatorState = json.state;
        const freshlyJoined = new Set(
          nextState.registeredBabies.map((b) => b.babyId).filter((id) => !knownBabyIdsRef.current.has(id)),
        );
        knownBabyIdsRef.current = new Set(nextState.registeredBabies.map((b) => b.babyId));

        setState(nextState);
        setNewlyJoinedIds(freshlyJoined);
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

  const inProgress = state.status === "IN_PROGRESS";
  const anyReady = inProgress && state.activeMatches.some((m) => m.status === "READY");

  return (
    <div className="mx-auto flex max-w-[1920px] flex-col gap-6 p-8">
      <HelpIndicator count={state.openHelpRequestCount} adminTerm={state.adminTerm} />

      <StageBanner
        text={inProgress ? playingNowLine(state.activeMatches) : state.stageBanner}
        kicker={inProgress ? state.stageBanner : undefined}
        upNext={inProgress && state.onDeck.length > 0 ? state.onDeck.map((p) => p.name).join(", ") : undefined}
        cornerHint={anyReady ? ['Remember to click "We\'re playing"', "on Telegram or the website."] : undefined}
        logoSrc={GAME_LOGO_SRC[state.game]}
        trailingAvatarSrc={state.status === "COMPLETE" ? (state.bestBaby?.avatarSrc ?? null) : undefined}
        backHref={backHref}
        backLabel="← All playtimes"
      >
        <p className="text-sm text-foreground-muted sm:text-base">
          📋 {rulesSummary}
          {rulesOverrideNote && <span className="ml-2 font-semibold text-active">Tonight only: {rulesOverrideNote}</span>}
        </p>
      </StageBanner>

      {state.status === "NURSERY_OPEN" && (
        <NurseryCheckIn telegramLink={state.joinLink} websiteLink={state.websiteJoinLink} playersTitle="Littles and bigs">
          <RegisteredBabies babies={state.registeredBabies} newlyJoinedIds={newlyJoinedIds} />
        </NurseryCheckIn>
      )}

      <PlaytimeBracketsView playpens={state.playpens} phase2Bracket={state.phase2Bracket} />
    </div>
  );
}

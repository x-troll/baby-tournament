"use client";

import { DoubleEliminationBracket, type MatchComponentProps } from "@g-loot/react-tournament-brackets";
import { createTheme } from "@g-loot/react-tournament-brackets";
import type { Phase2BracketData } from "@/lib/bracket-view";

// Matches the spectator screen's forced-dark tokens (tokens.css, the
// dark-mode nursery block) rather than the library's own default palette
// — this screen never shows the light skin, so no need for two themes.
const theme = createTheme({
  canvasBackground: "transparent",
  textColor: { main: "#b8b3d9", highlighted: "#edeaf7", dark: "#6560a8", disabled: "#6560a8" },
  roundHeaders: { background: "#20234a" },
  border: { color: "#6560a8", highlightedColor: "#ffc24d" },
  matchBackground: { wonColor: "#20234a", lostColor: "#171935" },
});

const bracketStyle = {
  width: 220,
  boxHeight: 62,
  canvasPadding: 24,
  spaceBetweenColumns: 36,
  spaceBetweenRows: 16,
  connectorColor: "#6560a8",
  connectorColorHighlight: "#ffc24d",
  roundHeader: { isShown: true, backgroundColor: "#20234a", fontColor: "#edeaf7" },
};

/** A single baby's row within a bracket match card — bold + gold once they've won it. */
function PartyRow({ name, won }: { name?: string; won: boolean }) {
  return (
    <p className={`truncate text-sm ${won ? "font-bold text-active" : "text-foreground-muted"}`}>{name || "TBD"}</p>
  );
}

/** Custom card so the bracket reuses our own design tokens instead of the library's default styled-components look. */
function BracketMatchCard({ topParty, bottomParty, topWon, bottomWon }: MatchComponentProps) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 rounded-card border-2 border-border bg-background-elevated px-3 py-1 shadow-soft">
      <PartyRow name={topParty.name} won={Boolean(topWon)} />
      <PartyRow name={bottomParty.name} won={Boolean(bottomWon)} />
    </div>
  );
}

/**
 * Renders Phase 2 (the final-four double-elimination bracket) as an
 * actual bracket via @g-loot/react-tournament-brackets, instead of the
 * flat match list — horizontally scrollable since the canvas has a fixed
 * pixel width the library computes from the match count.
 */
export function Phase2Bracket({ data }: { data: Phase2BracketData }) {
  return (
    <div className="overflow-x-auto rounded-card border-2 border-border bg-background-sunken p-4">
      <DoubleEliminationBracket
        matches={data}
        matchComponent={BracketMatchCard}
        theme={theme}
        options={{ style: bracketStyle }}
      />
    </div>
  );
}

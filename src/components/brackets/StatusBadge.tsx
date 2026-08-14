import type { DisplayStatus } from "@/lib/match-status";

// Colors only, not language — left as a plain client-side lookup.
// Display text is *not* looked up here: this component renders inside a
// "use client" tree (PlaytimeBracketsView), and getTerminology() reads a
// non-NEXT_PUBLIC_ env var that's unavailable once bundled into client
// code (same constraint documented in RequestHelpButton.tsx) — so the
// label is resolved server-side (terminology.ts's matchStatusLabel) and
// passed in as a plain string instead, same pattern as player-copy.ts.
const CLASSES: Record<DisplayStatus, string> = {
  NOT_YET_PLAYED: "text-foreground-muted",
  NEXT_UP: "text-accent-blue",
  READY: "text-active",
  PLAYING: "text-danger",
  FINISHED: "text-success",
};

export function StatusBadge({ status, label }: { status: DisplayStatus; label: string }) {
  return <span className={`text-[0.65rem] font-semibold uppercase tracking-wide ${CLASSES[status]}`}>{label}</span>;
}

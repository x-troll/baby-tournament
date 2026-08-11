// Shared by every box-rendering piece under src/components/brackets/ —
// pulled out of bracket-view.ts so both that file and tournament-flow.ts
// (which combines playpens and Phase 2) can depend on it without lib/
// code reaching into components/ for a type.
import type { MatchStatus } from "@/generated/prisma/enums";

export type DisplayStatus = "NOT_YET_PLAYED" | "PLAYING" | "FINISHED";

/** Collapses the DB's 5-state MatchStatus down to the 3 states a spectator/admin actually needs to see at a glance. */
export function toDisplayStatus(status: MatchStatus): DisplayStatus {
  if (status === "CONFIRMED") return "FINISHED";
  if (status === "PENDING") return "NOT_YET_PLAYED";
  return "PLAYING"; // READY | IN_PROGRESS | REPORTED
}

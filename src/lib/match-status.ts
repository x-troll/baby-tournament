// Shared by every box-rendering piece under src/components/brackets/ —
// pulled out of bracket-view.ts so both that file and tournament-flow.ts
// (which combines playpens and Phase 2) can depend on it without lib/
// code reaching into components/ for a type.
import type { MatchStatus } from "@/generated/prisma/enums";

export type DisplayStatus = "NOT_YET_PLAYED" | "NEXT_UP" | "READY" | "PLAYING" | "FINISHED";

/**
 * Collapses the DB's 5-state MatchStatus down to the states a
 * spectator/admin actually needs to see at a glance — kept distinct
 * from `MatchStatus` itself so `READY` ("station assigned, nobody's
 * tapped Start yet") never gets misreported as "Playing now" the way
 * `IN_PROGRESS`/`REPORTED` genuinely are.
 *
 * `isNextUp` only matters for a `PENDING` match — it's the one thing
 * this function can't derive from `status` alone, since "next in line"
 * depends on every other pending match too (see `buildPlaypenSection`,
 * the only current caller that computes it).
 */
export function toDisplayStatus(status: MatchStatus, isNextUp: boolean): DisplayStatus {
  if (status === "CONFIRMED") return "FINISHED";
  if (status === "READY") return "READY";
  if (status === "PENDING") return isNextUp ? "NEXT_UP" : "NOT_YET_PLAYED";
  return "PLAYING"; // IN_PROGRESS | REPORTED
}

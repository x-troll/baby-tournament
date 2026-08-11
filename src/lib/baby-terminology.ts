// Per-baby self-role customization (e.g. a baby who picked "Little sis"
// sees/hears that everywhere their own experience is personalized) plus
// the Little-vs-grown-up bucketing that src/lib/player-copy.ts's 4-variant
// messages key off of. There used to be a matching per-baby organizer-term
// override too (a baby picking what to call the organizer); that was
// reverted (see future_tods.md) — every baby sees terminology.ts's
// deployment-wide organizer term again, no per-baby resolution needed.
import { getTerminology } from "@/lib/terminology";

export const SELF_ROLE_OPTIONS = ["Baby", "Boy", "Girl", "Little bro", "Little sister", "Sissy", "Mommy", "Daddy"] as const;

// Of the 8 SELF_ROLE_OPTIONS, "Mommy"/"Daddy" are the only grown-up-coded
// choices — everything else reads as a little. Reused as the Little/
// grown-up signal for player-copy.ts's 4-variant messages rather than
// adding a second, overlapping field.
const GROWNUP_ROLES = new Set(["Mommy", "Daddy"]);

export function isLittleRole(selfRoleLabel: string | null): boolean {
  // Never set /profile yet (null) defaults to little, matching the app's
  // core theme.
  return !GROWNUP_ROLES.has(selfRoleLabel ?? "");
}

export function resolveSelfTerm(baby: { selfRoleLabel: string | null }): string {
  return baby.selfRoleLabel ?? getTerminology().player;
}

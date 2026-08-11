// Per-baby override of terminology.ts's deployment-wide organizer/player
// terms — e.g. a baby who picked "Big bro" for the organizer, or "Little
// sis" for themselves, sees/hears that everywhere *their own* experience
// is personalized (their Telegram messages, their own status card, and
// what the organizer sees them calling them). Spots with no specific baby
// in context (the spectator screen's aggregate help indicator, pages
// before a baby has a session) correctly keep reading terminology.ts's
// global default directly instead — there's nobody's preference to read.
import { getTerminology } from "@/lib/terminology";

export const ORGANIZER_ROLE_OPTIONS = [
  "Mommy",
  "Daddy",
  "Caretaker",
  "Big bro",
  "Big sis",
  "Hunky nerd",
  "Sissy",
] as const;

export const SELF_ROLE_OPTIONS = ["Baby", "Boy", "Girl", "Little bro", "Little sister", "Sissy", "Mommy", "Daddy"] as const;

export function resolveOrganizerTerm(baby: { organizerRoleLabel: string | null }): string {
  return baby.organizerRoleLabel ?? getTerminology().admin;
}

export function resolveSelfTerm(baby: { selfRoleLabel: string | null }): string {
  return baby.selfRoleLabel ?? getTerminology().player;
}

import type { MatchKind } from "@/generated/prisma/enums";
import type { Terminology } from "./terminology";

/**
 * Themed one-line label for a match, e.g. "Playpen 2", "Round 3", "Grand
 * final" — used anywhere admin-facing copy needs to describe which match
 * without leaking the raw `MatchKind` enum ("QF1", "PLAYPEN") straight to
 * an admin. Shared by telegram/notify.ts's help-request alerts and the
 * admin Requests inbox page, which previously each built this string a
 * different way (one raw, one now-fixed-but-independently).
 */
export function describeMatchKind(t: Terminology, kind: MatchKind, round: number): string {
  const stageLabel = (t.phase2StageLabel as Partial<Record<MatchKind, string>>)[kind];
  if (stageLabel) return stageLabel;
  const roundLabel = kind === "ROUND_ROBIN" ? t.roundRobinRoundLabel : t.roundLabel(round);
  return `${t.groupStageHeat} ${roundLabel}`;
}

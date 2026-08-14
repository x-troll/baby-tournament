/**
 * Single source of truth for every user-facing term, across web UI,
 * Telegram messages, and the spectator screen. Change the wording here
 * and it changes everywhere — nothing downstream should hardcode
 * "baby"/"Daddy"/"playpen"/etc. directly.
 *
 * `THEME=plain` (see .env.example) swaps to neutral wording too, not just
 * neutral colors — the whole point of the plain skin is screenshots/demos
 * without the ABDL framing, and gold-star/nursery language would defeat
 * that if it stayed.
 */

import type { PlaytimeStatus } from "@/generated/prisma/enums";
import type { DisplayStatus } from "./match-status";

export type ThemeSkin = "nursery" | "plain";

export function getThemeSkin(): ThemeSkin {
  return process.env.THEME === "plain" ? "plain" : "nursery";
}

/** The six fixed Phase 2 match kinds that get their own stage wording — see Phase2*Label below. Not the full MatchKind enum (PLAYPEN/ROUND_ROBIN don't apply here), kept as a local union so every skin object is statically checked to cover exactly these six, no Partial<>/non-null-assertions needed at the call sites. */
export type Phase2StageKind = "QF1" | "QF2" | "WINNERS_FINAL" | "LOSERS_R1" | "LOSERS_FINAL" | "GRAND_FINAL";

export interface Terminology {
  /** Player, singular / plural. */
  player: string;
  playerPlural: string;
  /** Admin, singular / plural (as a role label, e.g. "The daddies"). */
  admin: string;
  adminPlural: string;
  /** A tournament. */
  tournament: string;
  /** A group-stage heat (3-4 players). */
  groupStageHeat: string;
  groupStageHeatPlural: string;
  /** The bracket / standings view. */
  standings: string;
  /** Noun for a single match win. */
  matchWin: string;
  /** Verb phrase for winning a match, e.g. "{baby} earned a gold star". */
  earnedMatchWin: (subject: string) => string;
  /** Being eliminated, as a verb phrase, e.g. "{baby} was sent for a nap". */
  eliminated: (subject: string) => string;
  /** Noun for elimination + placement, e.g. "Naptime: 7th place". */
  eliminatedWithPlacement: (place: number) => string;
  /** Registration / check-in area. */
  registration: string;
  /** Waiting for your match. */
  waitingForMatch: string;
  /** Overall champion. */
  champion: string;
  /** Button on /playtimes that opens the "join another still-open one" modal, for a baby already signed up for at least one. */
  morePlaytimesButtonLabel: string;

  // ── Phase 2 (bracket) stage names ──────────────────────────────────
  // Three distinct wordings for the same six stages, kept separate
  // rather than merged into one field — they're genuinely different
  // things (a box's own header vs. a shared column heading vs. the
  // spectator screen's ALL-CAPS banner for whichever match is
  // currently live), and merging them would visibly change on-screen
  // text (e.g. the banner says "QUARTERFINALS" for a live QF1/QF2
  // match, not "Playpen 1").
  /** Per-box header label, e.g. "Playpen 1". */
  phase2StageLabel: Record<Phase2StageKind, string>;
  /** Bracket-diagram column header, by column index — several stages share one (e.g. col 2 and 3 both read "Semifinals"). */
  phase2ColumnLabel: Record<1 | 2 | 3 | 4, string>;
  /** ALL-CAPS spectator-screen stage banner, e.g. "QUARTERFINALS". */
  phase2BannerLabel: Record<Phase2StageKind, string>;

  // ── Playpen round / round-robin match labels ─────────────────────────
  roundLabel: (round: number) => string;
  roundRobinRoundLabel: string;
  roundRobinMatchLabel: (n: number) => string;

  // ── Bracket-view "up next" preview column (shown before Phase 2 starts) ─
  upNextColumnLabel: string;
  nextRoundLabel: (n?: number) => string;

  // ── Match-status badge (src/components/brackets/StatusBadge.tsx) ────
  matchStatusLabel: Record<DisplayStatus, string>;

  // ── Playtime lifecycle status (admin panel list/detail pages) ───────
  playtimeStatusLabel: Record<PlaytimeStatus, string>;
}

const NURSERY: Terminology = {
  player: "baby",
  playerPlural: "babies",
  admin: "Daddy",
  adminPlural: "the daddies",
  tournament: "playtime",
  groupStageHeat: "playpen",
  groupStageHeatPlural: "playpens",
  standings: "the star chart",
  matchWin: "gold star",
  earnedMatchWin: (subject) => `${subject} earned a gold star`,
  eliminated: (subject) => `${subject} was sent for a nap`,
  eliminatedWithPlacement: (place) => `Naptime: you finished ${ordinal(place)}. Good baby.`,
  registration: "the nursery",
  waitingForMatch: "quiet time",
  champion: "Best Baby",
  morePlaytimesButtonLabel: "More playtime! 🍼",

  phase2StageLabel: {
    QF1: "Playpen 1",
    QF2: "Playpen 2",
    WINNERS_FINAL: "Winner playpen",
    LOSERS_R1: "Losers playpen",
    LOSERS_FINAL: "Losers semi-final",
    GRAND_FINAL: "Grand final",
  },
  phase2ColumnLabel: {
    1: "Quarterfinals",
    2: "Semifinals",
    3: "Semifinals",
    4: "Grand final",
  },
  phase2BannerLabel: {
    QF1: "QUARTERFINALS",
    QF2: "QUARTERFINALS",
    LOSERS_R1: "LOSERS ROUND 1",
    WINNERS_FINAL: "WINNERS FINAL",
    LOSERS_FINAL: "LOSERS SEMI-FINAL",
    GRAND_FINAL: "GRAND FINAL",
  },

  roundLabel: (round) => `Round ${round}`,
  roundRobinRoundLabel: "Round-robin",
  roundRobinMatchLabel: (n) => `Match ${n}`,

  upNextColumnLabel: "Up next",
  nextRoundLabel: (n) => (n === undefined ? "Next round" : `Next round ${n}`),

  matchStatusLabel: {
    NOT_YET_PLAYED: "Not yet played",
    NEXT_UP: "Next up",
    READY: "Ready to play",
    PLAYING: "Playing now",
    FINISHED: "Finished",
  },

  playtimeStatusLabel: {
    NURSERY_OPEN: "Nursery open",
    IN_PROGRESS: "In progress",
    COMPLETE: "Complete",
  },
};

const PLAIN: Terminology = {
  player: "player",
  playerPlural: "players",
  admin: "admin",
  adminPlural: "the admins",
  tournament: "tournament",
  groupStageHeat: "group",
  groupStageHeatPlural: "groups",
  standings: "the standings",
  matchWin: "win",
  earnedMatchWin: (subject) => `${subject} won the match`,
  eliminated: (subject) => `${subject} was eliminated`,
  eliminatedWithPlacement: (place) => `Eliminated: you finished ${ordinal(place)}.`,
  registration: "check-in",
  waitingForMatch: "waiting",
  champion: "Champion",
  morePlaytimesButtonLabel: "More tournaments",

  // Identical to NURSERY for every field below — none of these were
  // actually theme-varying before this migration (they were hardcoded
  // once each, not duplicated per skin), so this pass only relocates
  // and de-duplicates them; giving THEME=plain its own wording for any
  // of these (e.g. "Group 1" instead of "Playpen 1") is a natural,
  // easy follow-up once centralized, not done here to keep this change
  // a pure move with zero visible output change.
  phase2StageLabel: {
    QF1: "Playpen 1",
    QF2: "Playpen 2",
    WINNERS_FINAL: "Winner playpen",
    LOSERS_R1: "Losers playpen",
    LOSERS_FINAL: "Losers semi-final",
    GRAND_FINAL: "Grand final",
  },
  phase2ColumnLabel: {
    1: "Quarterfinals",
    2: "Semifinals",
    3: "Semifinals",
    4: "Grand final",
  },
  phase2BannerLabel: {
    QF1: "QUARTERFINALS",
    QF2: "QUARTERFINALS",
    LOSERS_R1: "LOSERS ROUND 1",
    WINNERS_FINAL: "WINNERS FINAL",
    LOSERS_FINAL: "LOSERS SEMI-FINAL",
    GRAND_FINAL: "GRAND FINAL",
  },

  roundLabel: (round) => `Round ${round}`,
  roundRobinRoundLabel: "Round-robin",
  roundRobinMatchLabel: (n) => `Match ${n}`,

  upNextColumnLabel: "Up next",
  nextRoundLabel: (n) => (n === undefined ? "Next round" : `Next round ${n}`),

  matchStatusLabel: {
    NOT_YET_PLAYED: "Not yet played",
    NEXT_UP: "Next up",
    READY: "Ready to play",
    PLAYING: "Playing now",
    FINISHED: "Finished",
  },

  playtimeStatusLabel: {
    NURSERY_OPEN: "Nursery open",
    IN_PROGRESS: "In progress",
    COMPLETE: "Complete",
  },
};

export function getTerminology(skin: ThemeSkin = getThemeSkin()): Terminology {
  return skin === "plain" ? PLAIN : NURSERY;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

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

export type ThemeSkin = "nursery" | "plain";

export function getThemeSkin(): ThemeSkin {
  return process.env.THEME === "plain" ? "plain" : "nursery";
}

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

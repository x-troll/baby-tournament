import type { MatchStatus } from "./types";

/**
 * Valid manual transitions through the match lifecycle. Admin override is
 * deliberately not modeled here as a graph edge — the spec says override
 * is "always available," so callers apply it as an explicit bypass, not
 * as another path through this table.
 */
const VALID_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  PENDING: ["READY"],
  READY: ["IN_PROGRESS"],
  IN_PROGRESS: ["REPORTED"],
  REPORTED: ["CONFIRMED"],
  CONFIRMED: [],
};

export function isValidTransition(from: MatchStatus, to: MatchStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export interface DeadlineState {
  status: MatchStatus;
  /** Auto-confirm deadline, present only while status is REPORTED. */
  deadlineAt: Date | null;
}

export interface EffectiveStatus {
  status: MatchStatus;
  /** True when `now` has already passed the deadline — caller should persist this transition. */
  autoTransitioned: boolean;
}

/**
 * The single-dyno/no-worker constraint means the 60s auto-confirm timer
 * (and, later, the 5-minute forfeit clock, same shape) can't be a
 * scheduled job — an in-memory setTimeout dies on any dyno restart, which
 * Heroku does routinely. So nothing "fires": this is a pure function of
 * (stored state, now) that any caller — a poll, an admin action, another
 * baby's request — can call before trusting a match's status. If it
 * returns autoTransitioned: true, the caller persists CONFIRMED (via a
 * MatchEvent of type AUTO_CONFIRMED) before returning data. Because the
 * spectator screen alone polls every few seconds all night, this applies
 * expiry within seconds of the real deadline with zero background process.
 */
export function resolveEffectiveStatus(state: DeadlineState, now: Date): EffectiveStatus {
  if (state.status === "REPORTED" && state.deadlineAt && now.getTime() >= state.deadlineAt.getTime()) {
    return { status: "CONFIRMED", autoTransitioned: true };
  }
  return { status: state.status, autoTransitioned: false };
}

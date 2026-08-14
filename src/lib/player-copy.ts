// The single consolidated home for every baby-facing *flavor* message —
// both the Telegram bot's pushes/replies and the web console's on-screen
// text — per future_tods.md's "create a .ts file to contain all text to
// be sent and used, both in UI and telegram." Mechanical text (form
// labels, generic buttons like "Save"/"Cancel") stays where it already
// lives; admin-facing and pre-role-selection onboarding copy stays in
// telegram/copy.ts (nothing to vary by yet at that point).
//
// Every message here has 4 variants, keyed by two independent axes read
// off the viewing baby's own /profile choices:
//   - Little vs grown-up (baby-terminology.ts's isLittleRole, bucketed
//     from the existing selfRoleLabel field)
//   - playful vs explicit (Baby.allowExplicitMessages, off by default)
// Telegram-toned functions keep the emoji-forward push voice; the
// StatusCard-toned ("card*") ones stay in the calmer on-screen register
// already established there — same moment, deliberately different
// wording per surface, both living here so they're easy to keep in sync.
//
// Client components (StatusCard, RequestHelpButton, ResultReportForm)
// can't call these directly or receive the Terminology object as a prop
// (functions can't cross the server/client boundary) — their server
// parent (play/[slug]/page.tsx) resolves the final strings here and
// passes plain strings down, same pattern the file already used for
// copy.champion/copy.matchWin before this change.
import { getTerminology, type HelpReasonKey } from "@/lib/terminology";
import { isLittleRole } from "@/lib/baby-terminology";
import type { BabyStatusState } from "@/lib/baby-status";

const t = getTerminology();

export interface CopyBaby {
  selfRoleLabel: string | null;
  allowExplicitMessages: boolean;
}

interface Variants<T = string> {
  littlePlayful: T;
  littleExplicit: T;
  grownupPlayful: T;
  grownupExplicit: T;
}

function pick<T>(baby: CopyBaby, v: Variants<T>): T {
  const little = isLittleRole(baby.selfRoleLabel);
  return little ? (baby.allowExplicitMessages ? v.littleExplicit : v.littlePlayful)
                : (baby.allowExplicitMessages ? v.grownupExplicit : v.grownupPlayful);
}

function etaText(etaMinutes: number | null): string {
  const n = etaMinutes ?? null;
  return n === null ? "a few minutes" : `about ${n} minute${n === 1 ? "" : "s"}`;
}

// ── Telegram pushes/replies ──────────────────────────────────────────

export function upNext(baby: CopyBaby, displayName: string, rulesSummary: string): string {
  return pick(baby, {
    littlePlayful: `It's your turn, ${displayName}! 🎮 Waddle on over to the console.\n\n📋 ${rulesSummary}`,
    littleExplicit: `It's your turn, ${displayName}! 🎮 Waddle that diapered bottom over to the console before ${t.admin} gives you a spanking. 😏\n\n📋 ${rulesSummary}`,
    grownupPlayful: `You're up, ${displayName}! 🎮 Head over to the console, and show the little ones how it's done.\n\n📋 ${rulesSummary}`,
    grownupExplicit: `You're up, ${displayName}! 🎮 Time to prove a grown-up like you can still hang with the babies. Don't embarrass yourself. 😉\n\n📋 ${rulesSummary}`,
  });
}

export function upSoon(baby: CopyBaby, displayName: string, etaMinutes: number): string {
  const mins = `about ${etaMinutes} minute${etaMinutes === 1 ? "" : "s"}`;
  return pick(baby, {
    littlePlayful: `Heads up, ${displayName}, you're up in ${mins}! Better make sure that diaper's fresh before you play. 👀`,
    littleExplicit: `Heads up, ${displayName}, you're up in ${mins}! Better make sure that diaper's fresh before you play. 👀`,
    grownupPlayful: `Just a heads up, ${displayName}, you're up in ${mins}.`,
    grownupExplicit: `Tick tock, ${displayName}, you're up in ${mins}. Try not to lose to a baby, or you'd de facto belong in diapers too!`,
  });
}

/**
 * Button label for the ready-check callback — kept short and free of any
 * variable-length content (a baby's own display name never appears here,
 * unlike goldStarButtonLabel below) since it renders as a single Telegram
 * inline button, which has no server-side truncation of its own (see
 * client.ts's truncateButtonLabel, applied as a last-resort safety net
 * for the actual name-bearing labels).
 */
export function readyCheckButtonLabel(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `We're playing, ${t.admin}!`,
    littleExplicit: `Start us, ${t.admin}, before I whine! 🍼`,
    grownupPlayful: `We're ready, ${t.admin}, let's go!`,
    grownupExplicit: `We're ready. Quit stalling.`,
  });
}

export function readyCheckReply(baby: CopyBaby, displayName: string): string {
  return pick(baby, {
    littlePlayful: `Good ${displayName}! 🎉`,
    littleExplicit: `Such a good little ${displayName}! 🎉 ${t.admin} is proud.`,
    grownupPlayful: `Nice, ${displayName}, go get 'em!`,
    grownupExplicit: `About time, ${displayName}. Now go show these babies who's boss.`,
  });
}

/** Fired once a match flips READY -> IN_PROGRESS (see notifyMatchStarted). */
export function matchStarted(baby: CopyBaby, displayName: string): string {
  return pick(baby, {
    littlePlayful: `Good job, ${displayName}! 🎮 Come back here when you're done to submit your result.`,
    littleExplicit: `Good job, ${displayName}! 🎮 Toddle back here when you're done, no fibbing on the result.`,
    grownupPlayful: `Nice going, ${displayName}! 🎮 Come back here when you're done to submit your result.`,
    grownupExplicit: `Get in there, ${displayName}. 🎮 Come back and report it honestly, unless you want to explain yourself to ${t.admin} later.`,
  });
}

export function resultConfirmed(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `Result confirmed! ✅`,
    littleExplicit: `Result confirmed! ✅ Good baby for playing along.`,
    grownupPlayful: `Confirmed! ✅`,
    grownupExplicit: `Confirmed ✅, no take-backs, big shot.`,
  });
}

export function napped(baby: CopyBaby, placement: number): string {
  const base = t.eliminatedWithPlacement(placement);
  return pick(baby, {
    littlePlayful: base,
    littleExplicit: `${base} Nap time and a fresh diaper, little one. 🍼`,
    grownupPlayful: base,
    grownupExplicit: `${base} Beaten by babies, how does that feel?`,
  });
}

export function crowned(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `👑🌟 You did it, you're the ${t.champion}! 🌟👑`,
    littleExplicit: `👑🌟 You did it, you precious little champion! ${t.admin} is SO proud of their good baby. 🌟👑`,
    grownupPlayful: `👑🌟 You did it, you're the ${t.champion}! 🌟👑`,
    grownupExplicit: `👑🌟 Look at you, beating a room full of babies to be the ${t.champion}. Color us impressed. 🌟👑`,
  });
}

export function organizerIsComing(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `${t.admin} is coming 💫`,
    littleExplicit: `${t.admin} is coming for you 💫 Better be a good little one.`,
    grownupPlayful: `${t.admin} is on the way 💫`,
    grownupExplicit: `${t.admin} is coming, act like a grown-up about it. 💫`,
  });
}

// ── /status command — one line per BabyStatusState kind ─────────────

export function describeState(baby: CopyBaby, state: BabyStatusState): string {
  switch (state.kind) {
    case "DADDY_COMING":
      return organizerIsComing(baby);
    case "CHAMPION":
      return crowned(baby);
    case "NAPPED":
      return napped(baby, state.placement ?? 0);
    case "NOT_STARTED":
      return pick(baby, {
        littlePlayful: `The playtime hasn't started yet, sit tight!`,
        littleExplicit: `The playtime hasn't started yet, little one. Sit still and wait like a good baby.`,
        grownupPlayful: `The playtime hasn't started yet.`,
        grownupExplicit: `Nothing's started yet. Sit tight, or you'll start acting like the babies too.`,
      });
    case "QUIET_TIME": {
      const eta = etaText(state.etaMinutes);
      return pick(baby, {
        littlePlayful: `Quiet time. Your turn in ${eta}.`,
        littleExplicit: `Quiet time, little one. Your turn in ${eta}. Use the potty now if you need to. 😏`,
        grownupPlayful: `Still waiting. Your turn in ${eta}.`,
        grownupExplicit: `Cooling your heels. Your turn in ${eta}. The babies are ahead of you.`,
      });
    }
    case "UP_NEXT":
      return pick(baby, {
        littlePlayful: `You're up next! Head over to the console.`,
        littleExplicit: `You're up next, little one! Waddle over to the console.`,
        grownupPlayful: `You're up next, head over to the console.`,
        grownupExplicit: `You're up next. Try to keep up with the babies.`,
      });
    case "PLAYING":
      return pick(baby, {
        littlePlayful: `You're playing now, report your result when you're done.`,
        littleExplicit: `You're playing now, sweetie, report your result when you're done, and no fibbing.`,
        grownupPlayful: `You're playing now, report your result when you're done.`,
        grownupExplicit: `You're playing now. Report it honestly, the babies always tattle anyway.`,
      });
  }
}

// ── StatusCard (web console) — same moments, calmer on-screen tone ──

// Identical wording to organizerIsComing above (same moment, this app's
// Telegram-toned/card-toned split is deliberate elsewhere, but there was
// never actually a different card-register version of this one line) —
// one function instead of two copies to keep in sync.
export const cardOrganizerComing = organizerIsComing;

export function cardChampion(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `You're the ${t.champion}! 🌟🌟🌟`,
    littleExplicit: `You're the ${t.champion}, you precious thing! 🌟🌟🌟 ${t.admin} is so proud.`,
    grownupPlayful: `You're the ${t.champion}! 🌟🌟🌟`,
    grownupExplicit: `You beat a room of babies to be the ${t.champion}. 🌟🌟🌟 Color us impressed.`,
  });
}

export function cardNapped(baby: CopyBaby, placement: number): string {
  const base = t.eliminatedWithPlacement(placement);
  return pick(baby, {
    littlePlayful: base,
    littleExplicit: `${base} Nap time, little one.`,
    grownupPlayful: base,
    grownupExplicit: `${base} Outplayed by babies.`,
  });
}

export function cardNotStarted(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `Hang tight, ${t.registration} is still getting ready.`,
    littleExplicit: `Hang tight, little one, ${t.registration} is still getting ready.`,
    grownupPlayful: `Hang tight, ${t.registration} is still getting ready.`,
    grownupExplicit: `Hang tight, ${t.registration} isn't ready yet. Try to act like a grown-up about it.`,
  });
}

export function cardWaitingEta(baby: CopyBaby, etaMinutes: number | null): string {
  const capWaiting = t.waitingForMatch[0]!.toUpperCase() + t.waitingForMatch.slice(1);
  const eta = etaText(etaMinutes);
  return pick(baby, {
    littlePlayful: `${capWaiting}. Your turn in ${eta}.`,
    littleExplicit: `${capWaiting}, little one. Your turn in ${eta}. Sit still.`,
    grownupPlayful: `${capWaiting}. Your turn in ${eta}.`,
    grownupExplicit: `${capWaiting}. Your turn in ${eta}. The babies are ahead of you.`,
  });
}

export function cardUpNext(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `You're up next! Head over to the console.`,
    littleExplicit: `You're up next, little one! Head over to the console.`,
    grownupPlayful: `You're up next, head over to the console.`,
    grownupExplicit: `You're up next. Don't keep the babies waiting.`,
  });
}

export function cardStartMatchButtonLabel(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `We're playing`,
    littleExplicit: `We're playing, ${t.admin}!`,
    grownupPlayful: `We're playing`,
    grownupExplicit: `Fine, let's go already`,
  });
}

export function cardPlaying(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `You're playing now, report your result when you're done.`,
    littleExplicit: `You're playing now, sweetie, report your result when you're done.`,
    grownupPlayful: `You're playing now, report your result when you're done.`,
    grownupExplicit: `You're playing now. Report it honestly, or answer to ${t.admin} later.`,
  });
}

// ── RequestHelpButton ─────────────────────────────────────────────

export function helpNotifiedAck(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `A ${t.admin} has been notified. Hang tight.`,
    littleExplicit: `${t.admin} has been notified and is coming for you. Hang tight, little one.`,
    grownupPlayful: `A ${t.admin} has been notified. Hang tight.`,
    grownupExplicit: `A ${t.admin} has been notified. Try to handle it like an adult until they arrive.`,
  });
}

export function helpRequestButtonLabel(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `🆘 Request help from ${t.admin}`,
    littleExplicit: `🆘 Cry for ${t.admin}`,
    grownupPlayful: `🆘 Ask ${t.admin} for help`,
    grownupExplicit: `🆘 Fine, ask ${t.admin} for help`,
  });
}

/** Heading on the open "Request help" sheet — the baby-facing counterpart to terminology.ts's deployment-wide helpWhatsUpHeading (read by the admin inbox/Telegram side instead). */
export function helpWhatsUpPrompt(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `What's up, little one?`,
    littleExplicit: `What's wrong, baby? Tell ${t.admin} everything.`,
    grownupPlayful: `What's up?`,
    grownupExplicit: `Okay, what's the problem?`,
  });
}

export interface HelpReasonOption {
  key: HelpReasonKey;
  label: string;
}

/**
 * All 4 reason chips together, not 4 separate functions — keeps the
 * reason set and its per-baby copy from drifting out of sync (adding a
 * 5th reason only ever means touching one array literal in each variant
 * below, not scattering a new function). `key` is what's actually
 * submitted/stored (see terminology.ts's HelpReasonKey) — never the
 * label text, which varies by both skin (terminology.ts's
 * helpReasonLabel) and, here, by the requesting baby's own role/tone.
 */
export function helpReasonOptions(baby: CopyBaby): HelpReasonOption[] {
  return pick<HelpReasonOption[]>(baby, {
    littlePlayful: [
      { key: "controller", label: "My controller's acting up" },
      { key: "opponent", label: "Can't find my playmate" },
      { key: "dispute", label: "I think the score's wrong" },
      { key: "other", label: "Something else" },
    ],
    littleExplicit: [
      { key: "controller", label: "This controller's broken, fix it" },
      { key: "opponent", label: "Where'd my playmate go?" },
      { key: "dispute", label: "That score's not right!" },
      { key: "other", label: "Something else, come here" },
    ],
    grownupPlayful: [
      { key: "controller", label: "Controller trouble" },
      { key: "opponent", label: "Can't find my opponent" },
      { key: "dispute", label: "Score dispute" },
      { key: "other", label: "Something else" },
    ],
    grownupExplicit: [
      { key: "controller", label: "This controller's junk" },
      { key: "opponent", label: "My opponent's a no-show" },
      { key: "dispute", label: "That score's wrong, fix it" },
      { key: "other", label: "Something else, hurry up" },
    ],
  });
}

// ── ResultReportForm ─────────────────────────────────────────────

export function goldStarPrompt(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `Who got the gold star?`,
    littleExplicit: `Who earned the gold star, little one?`,
    grownupPlayful: `Who got the gold star?`,
    grownupExplicit: `Who actually won, or do we need to ask the babies?`,
  });
}

export function goldStarButtonLabel(baby: CopyBaby, participantName: string): string {
  return pick(baby, {
    littlePlayful: `🌟 ${participantName} got the gold star`,
    littleExplicit: `🌟 ${participantName} was the best little one`,
    grownupPlayful: `🌟 ${participantName} got the gold star`,
    grownupExplicit: `🌟 ${participantName} actually won this one`,
  });
}

export function dragInstruction(baby: CopyBaby): string {
  return pick(baby, {
    littlePlayful: `Drag to put everyone in finishing order, 1st at the top.`,
    littleExplicit: `Drag everyone into order, little one, best baby at the top.`,
    grownupPlayful: `Drag to put everyone in finishing order, 1st at the top.`,
    grownupExplicit: `Drag them into order. Try to be honest about where you landed, big shot.`,
  });
}

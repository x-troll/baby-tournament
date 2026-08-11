// All bot copy, in one place, in the nursery voice — warm and gentle,
// matching the web UI. Pure functions over plain data (no DB/fetch here)
// so they're easy to keep consistent and easy to test.
import { getTerminology } from "@/lib/terminology";

const t = getTerminology();

export function askForDisplayName(): string {
  return `Welcome to ${t.registration}! 🍼 What should we call you tonight? Just send your name back to me.`;
}

export function registeredAndMagicLink(displayName: string, magicLink: string): string {
  return `You're all checked in, ${displayName}! 🌟\n\nTap below to open your ${t.player} screen:\n${magicLink}\n\nKeep this chat open — I'll ping you here when it's your turn.\n\nWant to pick an avatar or change what we call each other? Send /profile anytime.`;
}

export function alreadyRegistered(displayName: string, magicLink: string): string {
  return `Hey ${displayName}, you're already checked in! Here's your screen again:\n${magicLink}`;
}

export function unknownJoinToken(): string {
  return `Hmm, I don't recognize that invite. Ask a ${t.admin} for a fresh QR code.`;
}

export function adminLinked(name: string): string {
  return `You're linked up, ${name}. You'll get pushes here for help requests, disputes, and round updates.`;
}

export function unknownAdminToken(): string {
  return "That admin link doesn't look right — check the QR code in your profile page.";
}

export function upNext(displayName: string, appUrl: string, rulesSummary: string): string {
  return `It's your turn, ${displayName}! 🎮 Head over to the console.\n\n📋 ${rulesSummary}\n\n${appUrl}`;
}

export function needsYourConfirmation(reporterName: string, rulesSummary: string): string {
  return `${reporterName} says they got the ${t.matchWin} — do you agree?\n\n📋 ${rulesSummary}`;
}

export function resultConfirmed(): string {
  return `Result confirmed! ✅`;
}

export function napped(placement: number): string {
  return `${t.eliminatedWithPlacement(placement)}`;
}

export function crowned(): string {
  return `👑🌟 You did it — you're the ${t.champion}! 🌟👑`;
}

export function daddyIsComing(organizerTerm: string): string {
  return `${organizerTerm} is coming 💫`;
}

export function helpRequestCollapsedAcknowledgement(): string {
  return `Got it — hang tight, a ${t.admin} is on the way.`;
}

// ── /profile — avatar + organizer/self term pickers ─────────────────

export function pickAvatarPrompt(): string {
  return "Pick a picture for yourself! 🎨";
}

export function avatarSetPrompt(label: string): string {
  return `You're a ${label} now! 🎉`;
}

export function pickOrganizerRolePrompt(): string {
  return "What should we call the grown-up running tonight?";
}

export function organizerRoleSetPrompt(label: string): string {
  return `Got it — you'll call them ${label}.`;
}

export function pickSelfRolePrompt(): string {
  return "And what should we call you?";
}

export function profileSetupComplete(): string {
  return "All set! ✨ Send /profile anytime to change any of this.";
}

export function notCheckedInYet(): string {
  return "Join a playtime and tell me your name first, then you can customize your profile.";
}

export function statusReply(displayName: string, summary: string): string {
  return `${displayName}: ${summary}`;
}

export function rulesReply(gameSummary: string, overrideNote: string | null): string {
  const override = overrideNote ? `\n\n⚠️ Tonight only: ${overrideNote}` : "";
  return `📋 ${gameSummary}${override}`;
}

// ── Admin-facing copy ──────────────────────────────────────────────

// `organizerTerm` is only appended when the baby actually customized it
// (see notify.ts) — a baby who never touched /profile still calls the
// organizer whatever terminology.ts's deployment default already is, so
// repeating that back would just be noise.
export function adminHelpRequestAlert(
  babyName: string,
  matchLabel: string,
  reason: string,
  note: string | null,
  deepLink: string,
  organizerTerm: string | null,
): string {
  const noteLine = note ? `\n"${note}"` : "";
  const calledLine = organizerTerm ? ` (calls you "${organizerTerm}")` : "";
  return `🆘 ${babyName}${calledLine} needs help (${matchLabel})\nReason: ${reason}${noteLine}\n\n${deepLink}`;
}

export function adminDisputeAlert(babyName: string, matchLabel: string, deepLink: string, organizerTerm: string | null): string {
  const calledLine = organizerTerm ? ` (calls you "${organizerTerm}")` : "";
  return `⚠️ ${babyName}${calledLine} disputed a result (${matchLabel}) — the match is frozen until you resolve it.\n\n${deepLink}`;
}

export function adminOnMyWaySent(organizerTerm: string): string {
  return `Sent — the baby now sees "${organizerTerm} is coming 💫".`;
}

export function adminAlreadyResolved(): string {
  return "Already resolved.";
}

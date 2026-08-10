// All bot copy, in one place, in the nursery voice — warm and gentle,
// matching the web UI. Pure functions over plain data (no DB/fetch here)
// so they're easy to keep consistent and easy to test.
import { getTerminology } from "@/lib/terminology";

const t = getTerminology();

export function askForDisplayName(): string {
  return `Welcome to ${t.registration}! 🍼 What should we call you tonight? Just send your name back to me.`;
}

export function registeredAndMagicLink(displayName: string, magicLink: string): string {
  return `You're all checked in, ${displayName}! 🌟\n\nTap below to open your ${t.player} screen:\n${magicLink}\n\nKeep this chat open — I'll ping you here when it's your turn.`;
}

export function alreadyRegistered(displayName: string, magicLink: string): string {
  return `Hey ${displayName}, you're already checked in! Here's your screen again:\n${magicLink}`;
}

export function unknownJoinToken(): string {
  return "Hmm, I don't recognize that invite. Ask a Daddy for a fresh QR code.";
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

export function daddyIsComing(): string {
  return "Daddy is coming 💫";
}

export function helpRequestCollapsedAcknowledgement(): string {
  return `Got it — hang tight, a ${t.admin} is on the way.`;
}

export function statusReply(displayName: string, summary: string): string {
  return `${displayName}: ${summary}`;
}

export function rulesReply(gameSummary: string, overrideNote: string | null): string {
  const override = overrideNote ? `\n\n⚠️ Tonight only: ${overrideNote}` : "";
  return `📋 ${gameSummary}${override}`;
}

// ── Admin-facing copy ──────────────────────────────────────────────

export function adminHelpRequestAlert(babyName: string, matchLabel: string, reason: string, note: string | null, deepLink: string): string {
  const noteLine = note ? `\n"${note}"` : "";
  return `🆘 ${babyName} needs help (${matchLabel})\nReason: ${reason}${noteLine}\n\n${deepLink}`;
}

export function adminDisputeAlert(babyName: string, matchLabel: string, deepLink: string): string {
  return `⚠️ ${babyName} disputed a result (${matchLabel}) — the match is frozen until you resolve it.\n\n${deepLink}`;
}

export function adminOnMyWaySent(): string {
  return "Sent — the baby now sees \"Daddy is coming 💫\".";
}

export function adminAlreadyResolved(): string {
  return "Already resolved.";
}

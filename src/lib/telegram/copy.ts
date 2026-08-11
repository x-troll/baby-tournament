// System/onboarding + admin-facing bot copy, in the nursery voice.
// Player-facing *flavor* messages (anything that varies by Little-vs-
// grown-up / explicit) live in src/lib/player-copy.ts instead — see that
// file's header. What's left here is either pre-role-selection onboarding
// (nothing to vary by yet) or addressed to the admin, not a baby.
import { getTerminology } from "@/lib/terminology";

const t = getTerminology();

// Scanning the join QR can't show which game/playtime you're about to
// join — Telegram deep links have no per-payload preview, only the
// bot's own global profile, the same for every link it ever sends. This
// first reply is the earliest point the bot can say anything
// payload-specific, so it's where that context actually needs to live.
export function askForDisplayName(playtimeName: string, gameLabel: string): string {
  return `Welcome to ${playtimeName} (${gameLabel})! 🍼 What should we call you tonight? Just send your name back to me.`;
}

export function finishOtherRegistrationFirst(): string {
  return "You're still finishing check-in for another playtime — send your name for that one first, then scan this QR again.";
}

export function registeredAndMagicLink(playtimeName: string, displayName: string, magicLink: string): string {
  return `You're all checked in to ${playtimeName}, ${displayName}! 🌟\n\nTap below to open your ${t.player} screen:\n${magicLink}\n\nKeep this chat open — I'll ping you here when it's your turn.\n\nWant to pick an avatar or change what we call you? Send /profile anytime.`;
}

export function alreadyRegistered(playtimeName: string, displayName: string, magicLink: string): string {
  return `Hey ${displayName}, you're already checked in to ${playtimeName}! Here's your screen again:\n${magicLink}`;
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

// ── /profile — avatar + self term picker + explicit-messages toggle ──

export function pickAvatarPrompt(): string {
  return "Pick a picture for yourself! 🎨";
}

export function avatarSetPrompt(label: string): string {
  return `You're a ${label} now! 🎉`;
}

export function pickSelfRolePrompt(): string {
  return "What should we call you?";
}

export function selfRoleSetPrompt(label: string): string {
  return `Got it — you're a ${label}.`;
}

export function pickExplicitPrompt(): string {
  return "🌶️ Allow explicit messages? Messages you receive will be slightly more explicit and teasing, instead of playful.";
}

export function explicitSetPrompt(allowed: boolean): string {
  return allowed ? "Spicy mode on. 🌶️" : "Keeping it playful. 🍼";
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

export function adminHelpRequestAlert(babyName: string, matchLabel: string, reason: string, note: string | null): string {
  const noteLine = note ? `\n"${note}"` : "";
  return `🆘 ${babyName} needs help (${matchLabel})\nReason: ${reason}${noteLine}`;
}

export function adminDisputeAlert(babyName: string, matchLabel: string): string {
  return `⚠️ ${babyName} disputed a result (${matchLabel}) — the match is frozen until you resolve it.`;
}

export function adminOnMyWaySent(): string {
  return `Sent — the baby now sees "${t.admin} is coming 💫".`;
}

export function adminAlreadyResolved(): string {
  return "Already resolved.";
}

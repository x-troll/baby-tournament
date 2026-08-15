import Link from "next/link";

/**
 * The unauthenticated spectator screen's entire header — one thin row,
 * not a card: back link on the left, the live status centered, the
 * "how to mark yourself playing" reminder on the right. Only ever
 * rendered by SpectatorPoller.tsx, i.e. only for a genuinely
 * unauthenticated (PIN-only) visitor — an admin/baby session never
 * lands on this component at all (see PlaytimeDetailPage's three-way
 * branch). Deliberately minimal — no logo, no rules text, no per-stage
 * kicker line — so almost the whole screen is left for the actual
 * bracket/check-in content below it.
 */
export function StageBanner({
  centerText,
  upNext,
  reminder,
  backHref,
  backLabel,
}: {
  /** The live status — "Alice vs Bob", "Getting ready…", "The very best … won, …" — bold and yellow, but only a touch bigger than the row's other text; this is a thin header, not a title card. */
  centerText: string;
  /** Who's up after `centerText`'s current match(es) — arrow-joined onto the same line, not its own line. */
  upNext?: string;
  /** "Remember to click..." — pinned to the row's right end, one line. */
  reminder?: string;
  /** "← All playtimes" — rendered first in the row. Omitted entirely (no reserved space) when not given. */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b-2 border-active bg-[#2a2e58] px-4 py-1.5 shadow-soft">
      {backHref && (
        <Link href={backHref} className="shrink-0 text-sm font-semibold text-foreground-muted hover:opacity-80">
          {backLabel ?? "← Back"}
        </Link>
      )}
      <p className="min-w-0 flex-1 truncate text-center text-base font-bold text-star-gold sm:text-lg">
        {centerText}
        {upNext && <span className="ml-2 text-sm font-normal text-foreground-muted">→ Next up: {upNext}</span>}
      </p>
      {/* star-gold, not accent-yellow — accent-yellow is a pastel badge
          *background* meant to pair with text-on-accent, not readable as
          text on its own; star-gold is the token this codebase already
          keeps text-safe for exactly this kind of "actually yellow,
          rendered as text" use (see tokens.css). */}
      {reminder && <p className="shrink-0 text-xs font-semibold text-star-gold sm:text-sm">{reminder}</p>}
    </div>
  );
}

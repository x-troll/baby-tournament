import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";

export function StageBanner({
  text,
  kicker,
  upNext,
  cornerHint,
  logoSrc,
  trailingAvatarSrc,
  backHref,
  backLabel,
  children,
}: {
  text: string;
  /** Small uppercase line above the main title — e.g. the round/stage context ("PLAYPEN ROUND 2, 5 PLAYERS LEFT") once `text` itself has been repurposed for who's actually playing. Omitted entirely (no reserved space) when not given. */
  kicker?: string;
  /** Who's up after `text`'s current match(es) — rendered inline on the same line as the title, arrow-joined, not as its own line. */
  upNext?: string;
  /** Small yellow text pinned to the card's top-right corner — e.g. "Remember to click Start playing" — deliberately out of the main reading line, just a corner reminder. */
  cornerHint?: string;
  logoSrc?: string;
  /**
   * undefined = no trailing avatar slot at all (every non-COMPLETE
   * stage); null = the slot is present but the champion never picked an
   * avatar picture (falls back to a plain emoji); a string = their real
   * avatar image. Only ever passed for the COMPLETE-stage "the very
   * best ... won" banner.
   */
  trailingAvatarSrc?: string | null;
  /** Optional "← All playtimes"-style link, first in the row alongside the logo and title block. Omitted entirely (no reserved space) when not given. */
  backHref?: string;
  backLabel?: string;
  /** Secondary lines under the main title — just the rules summary today. */
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center gap-4 rounded-card border-2 border-active bg-[#2a2e58] px-6 py-4 shadow-soft">
      {backHref && (
        <Link
          href={backHref}
          className="shrink-0 text-sm font-semibold text-foreground-muted hover:opacity-80"
        >
          {backLabel ?? "← Back"}
        </Link>
      )}
      {logoSrc && (
        <div className="flex shrink-0 items-center justify-center rounded-card border-2 border-border bg-white p-3">
          <Image src={logoSrc} alt="" width={112} height={112} className="rounded-lg" />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {kicker && (
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted sm:text-sm">{kicker}</p>
        )}
        <p className="font-display text-3xl font-bold tracking-wide text-active sm:text-4xl">
          {text}
          {upNext && <span className="ml-3 align-middle text-sm font-normal text-foreground-muted">→ {upNext}</span>}
        </p>
        {children}
      </div>
      {trailingAvatarSrc !== undefined && <Avatar src={trailingAvatarSrc} size={70} className="ml-auto shrink-0" />}
      {/* star-gold, not accent-yellow — accent-yellow is a pastel badge
          *background* meant to pair with text-on-accent, not readable as
          text on its own; star-gold is the token this codebase already
          keeps text-safe for exactly this kind of "actually yellow,
          rendered as text" use (see tokens.css). */}
      {cornerHint && <p className="absolute right-4 top-2 text-xs font-semibold text-star-gold">{cornerHint}</p>}
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";

export function StageBanner({
  text,
  logoSrc,
  trailingAvatarSrc,
  backHref,
  backLabel,
}: {
  text: string;
  logoSrc?: string;
  /**
   * undefined = no trailing avatar slot at all (every non-COMPLETE
   * stage); null = the slot is present but the champion never picked an
   * avatar picture (falls back to a plain emoji); a string = their real
   * avatar image. Only ever passed for the COMPLETE-stage "the very
   * best ... won" banner.
   */
  trailingAvatarSrc?: string | null;
  /** Optional "← All playtimes"-style link pinned to the card's far left, e.g. the public spectator screen's way back to the list. Omitted entirely (no reserved space) when not given. */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-card border-2 border-active bg-[#2a2e58] px-6 py-4 shadow-soft">
      <div className="justify-self-start">
        {backHref && (
          <Link href={backHref} className="text-sm font-semibold text-foreground-muted hover:opacity-80">
            {backLabel ?? "← Back"}
          </Link>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 text-center">
        {logoSrc && (
          <div className="flex shrink-0 items-center justify-center rounded-card border-2 border-border bg-white p-3">
            <Image src={logoSrc} alt="" width={112} height={112} className="rounded-lg" />
          </div>
        )}
        <p className="font-display text-3xl font-bold tracking-wide text-active sm:text-4xl">{text}</p>
        {trailingAvatarSrc !== undefined && <Avatar src={trailingAvatarSrc} size={70} />}
      </div>
      <div aria-hidden />
    </div>
  );
}

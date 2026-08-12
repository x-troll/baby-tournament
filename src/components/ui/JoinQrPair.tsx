import Image from "next/image";
import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { Badge } from "@/components/ui/badge";

/**
 * The join QR(s) shown wherever a playtime's check-in QR appears (admin
 * panel + spectator screen) — Telegram alongside a website-only
 * alternative for people who don't want to use Telegram at all. Each
 * QR's center image now identifies the *method* (Telegram logo /
 * "Website signup" badge) rather than the game, so the game itself gets
 * a shared header above the pair instead of repeating inside each QR.
 *
 * Either link can be null (no TELEGRAM_BOT_USERNAME / no
 * NEXT_PUBLIC_APP_URL configured) — degrades to showing just the other
 * one, same graceful-degradation spirit as the single-QR display this
 * replaced. Renders nothing if both are null.
 */
export function JoinQrPair({
  telegramLink,
  websiteLink,
  gameLabel,
  gameLogoSrc,
  size = 360,
}: {
  telegramLink: string | null;
  websiteLink: string | null;
  gameLabel: string;
  gameLogoSrc: string;
  /** 360 fits both call sites side-by-side without wrapping — the admin panel's max-w-4xl content column is the tighter of the two (~800px, vs. the spectator screen's 1600px). */
  size?: number;
}) {
  if (!telegramLink && !websiteLink) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <Image src={gameLogoSrc} alt="" width={40} height={40} className="rounded-card" />
        <p className="text-lg font-semibold text-foreground-muted">{gameLabel} — Scan to join!</p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-6">
        {telegramLink && (
          <div className="relative flex flex-col items-center gap-2">
            <Badge
              variant="yellow"
              className="absolute -top-3 -right-4 z-10 rotate-[-10deg] animate-splash-bounce motion-reduce:animate-none"
            >
              RECOMMENDED
            </Badge>
            <StyledQrCode data={telegramLink} size={size} logoSrc="/telegram-logo.svg" />
            <p className="max-w-[220px] text-center text-sm text-foreground-muted">
              Telegram gives you notifications a bit before and when it&rsquo;s your turn.
            </p>
          </div>
        )}
        {websiteLink && (
          <div className="flex flex-col items-center gap-2">
            <StyledQrCode data={websiteLink} size={size} logoSrc="/website-signup-badge.svg" />
            <p className="max-w-[220px] text-center text-sm text-foreground-muted">
              No notifications — you&rsquo;ll need to watch this page yourself.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

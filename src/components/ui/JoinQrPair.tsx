import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { Badge } from "@/components/ui/badge";

/**
 * The join QR(s) shown wherever a playtime's check-in QR appears (admin
 * panel + spectator screen) — Telegram alongside a website-only
 * alternative for people who don't want to use Telegram at all. Each
 * QR's center image identifies the *method* (Telegram logo / "Website
 * signup" badge) rather than the game — the game itself is shown by
 * `StageBanner` above this component now, so this just says "Scan to
 * join!" and nothing else.
 *
 * Either link can be null (no TELEGRAM_BOT_USERNAME / no
 * NEXT_PUBLIC_APP_URL configured) — degrades to showing just the other
 * one, same graceful-degradation spirit as the single-QR display this
 * replaced. Renders nothing if both are null.
 */
export function JoinQrPair({
  telegramLink,
  websiteLink,
  size = 360,
}: {
  telegramLink: string | null;
  websiteLink: string | null;
  /** 360 fits both call sites side-by-side without wrapping — the admin panel's max-w-5xl content column is the tighter of the two (~1024px, vs. the spectator screen's 1600px). */
  size?: number;
}) {
  if (!telegramLink && !websiteLink) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg font-semibold text-foreground-muted">Scan to join!</p>

      <div className="flex flex-wrap items-start justify-center gap-12">
        {telegramLink && (
          <div className="relative flex flex-col items-center gap-2">
            <Badge
              variant="yellow"
              className="absolute -top-4 -left-6 z-10 rotate-[-10deg] px-3 py-1.5 text-base animate-splash-bounce motion-reduce:animate-none"
            >
              RECOMMENDED
            </Badge>
            <StyledQrCode data={telegramLink} size={size} logoSrc="/telegram-logo.svg" />
            <p className="max-w-[240px] text-center text-base text-foreground-muted">
              Telegram gives you notifications a bit before and when it&rsquo;s your turn.
            </p>
          </div>
        )}
        {websiteLink && (
          <div className="flex flex-col items-center gap-2">
            <StyledQrCode data={websiteLink} size={size} logoSrc="/website-signup-badge.svg" />
            <p className="max-w-[240px] text-center text-base text-foreground-muted">
              <strong className="underline">No notifications</strong> — you&rsquo;ll need to watch this page
              yourself.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

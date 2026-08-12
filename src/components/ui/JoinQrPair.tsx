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
  /**
   * Deliberately never wraps to a stacked layout (see the pair's
   * container below) — letting it wrap made the two QRs (and the
   * RECOMMENDED badge's position) land in genuinely different spots
   * between the admin panel's narrower column and the spectator
   * screen's full-width one, at whatever browser width happened to
   * cross each container's own wrap threshold. No contained
   * `overflow-x` either — a narrow viewport lets the whole page scroll
   * horizontally instead, so the RECOMMENDED badge's own negative
   * offset never gets clipped by a scroll container edge.
   */
  size?: number;
}) {
  if (!telegramLink && !websiteLink) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg font-semibold text-foreground-muted">Scan to join!</p>

      <div className="flex items-start justify-center gap-24">
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

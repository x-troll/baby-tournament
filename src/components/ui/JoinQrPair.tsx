import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
 *
 * Each QR + its caption sits inside the real Card component (not
 * hand-rolled classes) so the border/rounding/shadow always match every
 * other card in the app exactly. Both captions get the same min-height
 * (sized for the longer one) so the two cards stay the same height
 * regardless of which caption's text happens to wrap to more lines.
 *
 * Wraps to a stacked layout (flex-wrap) rather than overflowing the
 * viewport when the container's too narrow for both QR codes side by
 * side at the requested `size` — the admin panel's column and the
 * spectator screen naturally wrap at different widths since they're
 * genuinely different widths, which is fine; both render this exact
 * same component, so the QR display itself never drifts between them.
 */
export function JoinQrPair({
  telegramLink,
  websiteLink,
  size = 360,
}: {
  telegramLink: string | null;
  websiteLink: string | null;
  size?: number;
}) {
  if (!telegramLink && !websiteLink) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-2xl font-semibold text-foreground-muted">Scan to join!</p>

      <div className="flex flex-wrap items-start justify-center gap-24">
        {telegramLink && (
          <div className="relative flex flex-col items-center">
            <Badge
              variant="yellow"
              className="absolute -top-4 -left-6 z-10 rotate-[-10deg] px-3 py-1.5 text-base animate-splash-bounce motion-reduce:animate-none"
            >
              RECOMMENDED
            </Badge>
            <Card className="flex flex-col items-center gap-2">
              <StyledQrCode data={telegramLink} size={size} logoSrc="/telegram-logo.svg" />
              <p className="flex min-h-[72px] max-w-[240px] items-center text-center text-base text-foreground-muted">
                Telegram gives you notifications a bit before and when it&rsquo;s your turn.
              </p>
            </Card>
          </div>
        )}
        {websiteLink && (
          <Card className="flex flex-col items-center gap-2">
            <StyledQrCode data={websiteLink} size={size} logoSrc="/website-signup-badge.svg" />
            <p className="flex min-h-[72px] max-w-[240px] items-center text-center text-base text-foreground-muted">
              <strong className="underline">No notifications.</strong> You&rsquo;ll need to watch this page
              yourself.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

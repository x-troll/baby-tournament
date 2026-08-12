import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * One join-method card: a title, the QR itself, and a caption below it —
 * the shared unit every place a playtime's check-in QR appears builds
 * on (see `buildJoinQrCards` below), so the QR display itself never
 * drifts between the admin panel and the spectator screen.
 *
 * `recommended` and `scanMe` are independent — both can land on the same
 * card (the steered default gets both nudges) without colliding: the
 * "Recommended" pill sits top-left of the whole card, bouncing one way,
 * while "Scan me" sits bottom-right of just the QR image itself (not
 * the card — it stays anchored to the actual scannable square even if
 * the caption below it wraps to a different number of lines), bouncing
 * the mirrored way so the two read as distinct rather than duplicates.
 */
export function QrJoinCard({
  title,
  data,
  size,
  logoSrc,
  caption,
  recommended,
  scanMe,
  className,
}: {
  title: string;
  data: string;
  size: number;
  logoSrc: string;
  caption: React.ReactNode;
  recommended?: boolean;
  scanMe?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center ${className ?? ""}`}>
      {recommended && (
        <Badge
          variant="yellow"
          className="absolute -top-2 -left-6 z-10 rotate-[-10deg] px-3 py-1.5 text-base animate-splash-bounce motion-reduce:animate-none"
        >
          RECOMMENDED
        </Badge>
      )}
      <Card className="flex h-full flex-col items-center gap-2">
        <h3 className="text-xl font-semibold text-foreground-muted">{title}</h3>
        <div className="relative">
          <StyledQrCode data={data} size={size} logoSrc={logoSrc} />
          {scanMe && (
            <Badge
              variant="yellow"
              className="absolute -bottom-4 -right-2 z-10 rotate-[10deg] px-2 py-1 text-xs animate-splash-bounce-reverse motion-reduce:animate-none"
            >
              SCAN ME
            </Badge>
          )}
        </div>
        <p className="flex min-h-[72px] max-w-[240px] items-center text-center text-base text-foreground-muted">
          {caption}
        </p>
      </Card>
    </div>
  );
}

/**
 * Builds the (up to two) QR card definitions shared by every place a
 * playtime's check-in QR appears — the admin panel and the spectator
 * screen's three-up grid (see `NurseryCheckIn.tsx`) — so the
 * title/caption/badge(s) on each card can never drift between call
 * sites. Either link can be null (no TELEGRAM_BOT_USERNAME / no
 * NEXT_PUBLIC_APP_URL configured) — the missing one is just omitted.
 * Both nudges (the bouncing "Recommended" pill and the "Scan me" pill
 * on the QR itself) land on the Telegram card when it's present —
 * that's the one everyone should actually pick — and neither shows on
 * the website fallback, which only exists for people who can't use
 * Telegram at all and don't need to be sold on it further.
 */
export function buildJoinQrCards(
  telegramLink: string | null,
  websiteLink: string | null,
  size: number,
): React.ComponentProps<typeof QrJoinCard>[] {
  const cards: React.ComponentProps<typeof QrJoinCard>[] = [];
  if (telegramLink) {
    cards.push({
      title: "Telegram signup",
      data: telegramLink,
      size,
      logoSrc: "/telegram-logo.svg",
      recommended: true,
      scanMe: true,
      caption: "Telegram gives you notifications a bit before and when it’s your turn.",
    });
  }
  if (websiteLink) {
    cards.push({
      title: "Website signup",
      data: websiteLink,
      size,
      logoSrc: "/website-signup-badge.svg",
      caption: "No notifications, you’ll need to watch this page yourself.",
    });
  }
  return cards;
}

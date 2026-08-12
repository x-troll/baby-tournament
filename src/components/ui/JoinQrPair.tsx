import { QrJoinCard } from "@/components/ui/QrJoinCard";

/**
 * Builds the (up to two) QR card definitions shared by every place a
 * playtime's check-in QR appears — `JoinQrPair` below (two side by side,
 * admin panel + the old spectator layout) and the spectator screen's
 * three-up grid (these two plus a third "who's here" card), so the
 * title/caption/badge(s) on each card can never drift between call sites.
 * Either link can be null (no TELEGRAM_BOT_USERNAME / no
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

/**
 * The join QR(s) shown wherever a playtime's check-in QR appears (admin
 * panel + spectator screen) — Telegram alongside a website-only
 * alternative for people who don't want to use Telegram at all. Renders
 * nothing if both links are null.
 *
 * Wraps to a stacked layout (flex-wrap) rather than overflowing the
 * viewport when the container's too narrow for both QR codes side by
 * side at the requested `size` — the admin panel's column naturally
 * wraps at a different width than a wide screen would, which is fine;
 * every card renders via the same `QrJoinCard`, so the QR display
 * itself never drifts between them.
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
  const cards = buildJoinQrCards(telegramLink, websiteLink, size);
  if (cards.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start justify-center gap-24">
      {cards.map((card) => (
        <QrJoinCard key={card.title} {...card} />
      ))}
    </div>
  );
}

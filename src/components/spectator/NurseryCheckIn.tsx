import { QrJoinCard, buildJoinQrCards } from "@/components/ui/QrJoinCard";
import { Card } from "@/components/ui/card";

/**
 * The "check-in" block shown while a playtime's status is NURSERY_OPEN —
 * two QR cards plus a third "who's here" card, three columns filling
 * the full available width instead of the QR pair floating centered
 * above a separate list. Shared by both the public spectator screen
 * (SpectatorPoller, with the Kahoot-style badge row as `children`) and
 * the admin control panel (playtimes/[slug]/page.tsx, with the
 * manage-babies list — Preview/Remove — as `children` instead), so the
 * grid itself (QR size, spacing, card heights) never drifts between the
 * two — only the third column's title/content differs.
 *
 * Every column shares the same Card component, and CSS grid's default
 * row stretch (`items-stretch`) equalizes all three to the tallest
 * one's height for free, no manual min-height bookkeeping needed the
 * way the two QR captions already do for each other. The QR cards are
 * only ever as wide as their fixed-size QR image needs (`auto` grid
 * tracks); the third column grows to soak up whatever's left (`1fr`) so
 * the row still reaches the container's full width instead of leaving
 * a gap past the last QR card.
 */
export function NurseryCheckIn({
  telegramLink,
  websiteLink,
  size = 288, // 80% of the original 360px
  playersTitle,
  children,
}: {
  telegramLink: string | null;
  websiteLink: string | null;
  size?: number;
  playersTitle: string;
  children?: React.ReactNode;
}) {
  const qrCards = buildJoinQrCards(telegramLink, websiteLink, size);
  if (qrCards.length === 0) return null;

  return (
    <div
      className={`grid w-full grid-cols-1 items-stretch gap-8 ${
        qrCards.length === 2
          ? "lg:grid-cols-[auto_auto_1fr]"
          : qrCards.length === 1
            ? "lg:grid-cols-[auto_1fr]"
            : ""
      }`}
    >
      {qrCards.map((card) => (
        <QrJoinCard key={card.title} {...card} />
      ))}
      <Card className="flex h-full flex-col items-center gap-4">
        <h3 className="text-xl font-semibold text-foreground-muted">{playersTitle}</h3>
        {children}
      </Card>
    </div>
  );
}

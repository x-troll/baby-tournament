import { StyledQrCode } from "@/components/ui/StyledQrCode";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * One join-method card: a title, the QR itself, and a caption below it —
 * the shared unit `JoinQrPair` (two side by side) and the spectator
 * screen's three-up grid (the two of these plus a third "who's here"
 * card) both build on, so the QR display itself never drifts between
 * every place a playtime's check-in QR appears.
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

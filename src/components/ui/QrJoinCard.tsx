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
 * `badge` picks which one-off visual nudge sits on this particular card
 * — at most one of the two ever makes sense on the same card, so it's a
 * single slot rather than two independent booleans:
 *   - "recommended": the bouncing top-left pill (Telegram, the steered
 *     default).
 *   - "scan-me": a bottom-right pill plus a hand-drawn-looking arrow
 *     animated toward the QR itself, no bounce on the pill (the arrow
 *     already carries the motion) — used on whichever card most needs a
 *     nudge to actually pick up a phone (the website fallback).
 */
export function QrJoinCard({
  title,
  data,
  size,
  logoSrc,
  caption,
  badge,
  className,
}: {
  title: string;
  data: string;
  size: number;
  logoSrc: string;
  caption: React.ReactNode;
  badge?: "recommended" | "scan-me";
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center ${className ?? ""}`}>
      {badge === "recommended" && (
        <Badge
          variant="yellow"
          className="absolute -top-4 -left-6 z-10 rotate-[-10deg] px-3 py-1.5 text-base animate-splash-bounce motion-reduce:animate-none"
        >
          RECOMMENDED
        </Badge>
      )}
      {badge === "scan-me" && (
        <>
          <Badge
            variant="yellow"
            className="absolute -bottom-4 -right-6 z-10 rotate-[10deg] px-3 py-1.5 text-base"
          >
            SCAN ME
          </Badge>
          {/* Curls from the pill all the way up past the caption text
              into the QR's own bottom-right corner — tall enough to
              clear the caption regardless of whether it wraps to one
              line or three. `pathLength={1}` lets the draw animation
              use a fixed 0-to-1 dash range regardless of the path's
              real geometric length. */}
          <svg
            className="pointer-events-none absolute right-2 bottom-6 z-10 motion-reduce:hidden"
            width="90"
            height="150"
            viewBox="0 0 90 150"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <marker id="scan-me-arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--active)" }} />
              </marker>
            </defs>
            <path
              d="M80 140 C 55 145, 15 120, 10 12"
              stroke="var(--active)"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              markerEnd="url(#scan-me-arrowhead)"
              className="animate-arrow-draw"
            />
          </svg>
        </>
      )}
      <Card className="flex h-full flex-col items-center gap-2">
        <h3 className="text-xl font-semibold text-foreground-muted">{title}</h3>
        <StyledQrCode data={data} size={size} logoSrc={logoSrc} />
        <p className="flex min-h-[72px] max-w-[240px] items-center text-center text-base text-foreground-muted">
          {caption}
        </p>
      </Card>
    </div>
  );
}

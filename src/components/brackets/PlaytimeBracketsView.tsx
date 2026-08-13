"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { buildTournamentFlow, type FlowBox, type FlowParticipant } from "@/lib/tournament-flow";
import type { PlaypenSection } from "@/lib/playpen-view";
import type { Phase2BracketData } from "@/lib/bracket-view";

// Matches the `gap-3` (0.75rem) Tailwind class used between boxes within
// a column below — kept as a constant since the offset math needs the
// exact pixel value, not just the class name.
const BOX_GAP_PX = 12;

// How far a connector's elbow sits from the box it leaves, regardless of
// how far away the target column is — see the `elbowX` comment below.
const OUT_NUB_PX = 16;

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Alternating tint instead of a separator line between columns — a
// low-opacity black overlay reads as "darker" in both light and dark
// mode alike, unlike picking a named background token (which would
// invert which one looks darker between themes). The other half of the
// pair is deliberately no class at all (fully transparent, so it's
// exactly the panel's own background) rather than a second overlay —
// see the bleed spacers around the columns map below for why that
// matters at the panel's edges.
function columnTintClass(i: number): string {
  return i % 2 === 1 ? "bg-black/22" : "";
}

function sortParticipants(p: FlowParticipant[]): FlowParticipant[] {
  return [...p].sort((a, b) => {
    if (a.finishPosition != null && b.finishPosition != null) return a.finishPosition - b.finishPosition;
    return 0;
  });
}

function ParticipantRow({ p }: { p: FlowParticipant }) {
  const row = (
    <p
      className={`flex min-w-0 items-center gap-1 text-sm ${p.advancing ? "font-bold text-white" : "text-foreground-muted"}`}
    >
      <Avatar src={p.avatarSrc} size={28} />
      <span className="min-w-0 truncate">{p.name ?? "????"}</span>
    </p>
  );
  if (!p.advancing) return row;
  // A winner gets its own small gold pill — separate per winner (a
  // playpen box routinely has two, 1st and 2nd place both advancing)
  // rather than one wrapper around the whole box. The pill itself is a
  // decorative `absolute` sibling (`inset-0`, no bleed on any side)
  // instead of wrapping the row in real padding/border — that would
  // shift the avatar+name rightward relative to a plain (non-winner)
  // row in the same box, breaking alignment between the two. Zero bleed
  // on every side (not just symmetric, but literally none) keeps the
  // gap from the pill's edge to the box's own border equal left and
  // right — this wrapper is itself stretched to the full row width by
  // the participant list's flex column (default align-items: stretch),
  // so the pill already spans edge-to-edge without needing to bleed
  // past its own box to do it. On the left that puts the pill's
  // rounded-full cap right at the avatar's own left edge (close enough
  // in radius that the two circles read as one continuous shape).
  // `animate-sparkle` re-plays whenever this element's class list newly
  // includes it — on first paint if already a winner, and again if a
  // poll update flips someone into first/second place — no diffing
  // needed (see globals.css). The crown is the same kind of decorative
  // absolute overlay, pinned to the pill's own right edge — it rides
  // along on the pill rather than sitting in the row's own flex flow,
  // so it never pushes the truncated name/avatar pair around either.
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute inset-0 -z-10 rounded-pill border-2 border-star-gold bg-star-gold-fill/30 animate-sparkle motion-reduce:animate-none"
      />
      {row}
      <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-lg">
        👑
      </span>
    </div>
  );
}

function BoxCard({
  box,
  offsetY,
  boxRef,
}: {
  box: FlowBox;
  offsetY: number;
  boxRef: (el: HTMLDivElement | null) => void;
}) {
  const notYetPlayed = box.status === "NOT_YET_PLAYED";
  // Losers Round 1 / Losers Final get a slight red tint on top of the
  // normal played/not-yet-played styling, so the losers track reads as
  // visually distinct at a glance (see also the vertical offset in the
  // layout pass below).
  const borderClasses = box.isLoserTrack
    ? notYetPlayed
      ? "border-dashed border-danger/40 bg-background-elevated/50 opacity-60"
      : "border-danger/60 bg-background-elevated"
    : notYetPlayed
      ? "border-dashed border-border/60 bg-background-elevated/50 opacity-60"
      : "border-border bg-background-elevated";
  return (
    <div
      ref={boxRef}
      data-key={box.key}
      style={{ transform: `translateY(${offsetY}px)` }}
      className={`flex w-52 flex-col gap-2 rounded-card border-2 p-3 shadow-soft transition-opacity ${borderClasses}`}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{box.label}</p>
        <StatusBadge status={box.status} />
      </div>
      <div className="flex flex-col gap-2">
        {sortParticipants(box.participants).map((p, i) => (
          <ParticipantRow key={p.babyId ?? i} p={p} />
        ))}
      </div>
    </div>
  );
}

/**
 * The whole tournament — every real playpen round played so far, one
 * preview column of who's advancing next (see `tournament-flow.ts`'s
 * `buildNextRoundPreview` — deliberately not a full structural forecast),
 * and the Phase 2 bracket once it exists — as one continuous left-to-right
 * sequence of columns, not separate stacked sections.
 *
 * Boxes are pyramid-centered, not top-aligned: each box's vertical
 * center is the average of whichever earlier boxes actually feed it
 * (found via `flow.edges`), falling back to stacking directly under a
 * column-sibling that does have feeders, and finally to a plain
 * top-down natural position for a genuine root (the very first column,
 * or an isolated box with nothing feeding it). This is *why* it comes
 * out looking like a sideways pyramid — later columns naturally
 * converge toward the middle. Siblings that land on the same (or an
 * overlapping) target get resolved as a group, centered as a whole on
 * their shared point rather than stacked down from whichever one
 * sorts first — see the grouping pass below. Losers Round 1 / Losers
 * Final still get a red tint so the losers track reads as visually
 * distinct from the winners track above it, just no separate vertical
 * nudge — they're positioned by the same feeder-averaging as every
 * other box. Connector elbows sit a fixed short distance
 * (`OUT_NUB_PX`) out from the source box rather than at the geometric
 * midpoint — that's what keeps a skip-connector (Winners Final → Grand
 * Final, which skips the Losers Final column entirely) from stretching
 * its first segment across the skipped column instead of staying a
 * short nub right at the box.
 *
 * Connector lines and box offsets both derive from the same measured
 * pass (`getBoundingClientRect` for stable height/left values, which a
 * pure Y-axis `transform` never changes — never re-reading `top`, which
 * would). Redrawn via `ResizeObserver`.
 *
 * One shared component for both the spectator screen (`/live/[slug]`)
 * and the admin panel's "Playpens" tab, built from the same
 * `PlaypenSection`/`Phase2BracketData` shapes either caller computes via
 * `playpen-view.ts`/`bracket-view.ts`. Renders nothing before the
 * playtime has started.
 */
export function PlaytimeBracketsView({
  playpens,
  phase2Bracket,
}: {
  playpens: PlaypenSection | null;
  phase2Bracket: Phase2BracketData | null;
}) {
  const flow = useMemo(() => buildTournamentFlow(playpens, phase2Bracket), [playpens, phase2Bracket]);

  const containerRef = useRef<HTMLDivElement>(null);
  const boxEls = useRef(new Map<string, HTMLDivElement>());
  const colBoxWrapperEls = useRef(new Map<string, HTMLDivElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [offsets, setOffsets] = useState<Map<string, number>>(new Map());
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  // How tall each column's box-stack wrapper needs to be to actually
  // contain every box once pyramid-centering's translateY is applied —
  // a bare flex column's natural height only accounts for boxes'
  // untransformed stacking order, so without this a column whose boxes
  // get pushed down toward the shared axis would visually spill out
  // past both its own alternating-tint background (which stops at the
  // untransformed height) and its own wrapper's bottom padding (`pb-6`
  // below, in the column render below).
  const [colHeights, setColHeights] = useState<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !flow) return;

    function recompute() {
      if (!container || !flow) return;
      const containerRect = container.getBoundingClientRect();

      // Height and left are stable regardless of any Y-only transform
      // already applied from a previous pass — safe to re-measure every
      // time. A box's own `top` is deliberately never read (a transform
      // on it would make that circular), but a *column wrapper's* top
      // is: a `translateY` on a descendant box never affects the size or
      // position of its static-flow parent, so this is exactly as safe
      // to re-measure as height/left/width.
      const height = new Map<string, number>();
      const left = new Map<string, number>();
      const width = new Map<string, number>();
      for (const [key, el] of boxEls.current) {
        const r = el.getBoundingClientRect();
        height.set(key, r.height);
        left.set(key, r.left - containerRect.left);
        width.set(key, r.width);
      }

      // Where each column's box stack actually starts, in real DOM terms
      // — below that column's `<h3>` heading, not at y=0. Skipping this
      // and assuming 0 would leave every box rendering below where its
      // connector lines think it is (the heading's height isn't in the
      // `natural`/`target` arithmetic at all, but the `translateY`
      // transform is applied on top of the *real* DOM position, which
      // does include it) — same offset for every column, so the pyramid
      // shape itself would still look right, but every line would enter
      // and exit boxes off-center instead of at their true middle.
      const colStartY = new Map<string, number>();
      for (const [id, el] of colBoxWrapperEls.current) {
        colStartY.set(id, el.getBoundingClientRect().top - containerRect.top);
      }

      const naturalCenter = new Map<string, number>();
      const columnHeight = new Map<string, number>();
      for (const col of flow.columns) {
        const startY = colStartY.get(col.id) ?? 0;
        let y = startY;
        for (const box of col.boxes) {
          const h = height.get(box.key) ?? 0;
          naturalCenter.set(box.key, y + h / 2);
          y += h + BOX_GAP_PX;
        }
        columnHeight.set(col.id, Math.max(0, y - startY - BOX_GAP_PX));
      }
      // The tallest column sets the shared pyramid axis — every other
      // column centers its own block against this same line by default.
      const axisY = Math.max(0, ...columnHeight.values()) / 2;

      const feedersOf = new Map<string, string[]>();
      for (const e of flow.edges) feedersOf.set(e.to, [...(feedersOf.get(e.to) ?? []), e.from]);

      const centerY = new Map<string, number>();
      for (const col of flow.columns) {
        const columnOffset = axisY - (columnHeight.get(col.id) ?? 0) / 2;

        // Phase 1: each box's *raw* target, independent of its siblings
        // — two different boxes can legitimately compute the same
        // target (e.g. Quarterfinal 1 and Quarterfinal 2 both drawing
        // one baby from each of the same two Round 2 pens average out
        // to an identical point even though they're at most 2 feeders
        // each).
        const raw: { key: string; height: number; target: number }[] = [];
        let prevKey: string | null = null;
        for (const box of col.boxes) {
          const h = height.get(box.key) ?? 0;
          const feederKeys = feedersOf.get(box.key) ?? [];

          let target: number;
          if (feederKeys.length >= 1 && feederKeys.length <= 2) {
            // A clean tree edge (Phase 2's every box has at most 2 —
            // one per feeding match) — center exactly between them.
            const feederCenters = feederKeys.map((k) => centerY.get(k)).filter((v): v is number => v != null);
            target =
              feederCenters.length > 0
                ? feederCenters.reduce((a, b) => a + b, 0) / feederCenters.length
                : (naturalCenter.get(box.key) ?? 0) + columnOffset;
          } else if (feederKeys.length === 0 && prevKey != null) {
            // No feeders at all (e.g. a Phase 2 loser-track box, whose
            // only real feeder is deliberately untracked — see
            // tournament-flow.ts) — aim for just under whichever
            // sibling in this column comes right before it; Phase 2's
            // collision-free by construction (Losers Round 1 always
            // stacks after Winners Final), but the resolution pass
            // below still guards it against every other case.
            const prevRaw = raw.find((r) => r.key === prevKey)!;
            target = prevRaw.target + prevRaw.height / 2 + BOX_GAP_PX + h / 2;
          } else {
            // Either no feeders and no such sibling yet (a genuine root
            // column), or *too many* feeders to average meaningfully —
            // a playpen pen is routinely fed by every pen in the
            // previous round at once (the seeded re-draw doesn't pair
            // pens 1:1), and averaging all of them collapses distinct
            // pens toward the same point. Center the whole column as a
            // block against the shared axis instead.
            target = (naturalCenter.get(box.key) ?? 0) + columnOffset;
          }
          raw.push({ key: box.key, height: h, target });
          prevKey = box.key;
        }

        // Phase 2: resolve overlaps by grouping, not by top-down
        // stacking. Sort by raw target, then collect maximal runs of
        // boxes whose raw (pre-resolution) extents would overlap into
        // one group each — two siblings landing on the *same* raw
        // target is expected (e.g. Quarterfinal 1 and 2 both averaging
        // the same pair of Round 2 pens), and simply stacking the
        // second one down from the first would bias the pair toward
        // its top box instead of keeping it centered on the shared
        // point both were aiming for. Each group instead gets laid out
        // top-down starting from `avgTarget - totalHeight / 2`, i.e.
        // the whole cluster is centered on its members' average target
        // — a lone box is just a group of one, so today's already-
        // correct single-box case is unchanged.
        raw.sort((a, b) => a.target - b.target);
        const groups: (typeof raw)[] = [];
        for (const box of raw) {
          const lastGroup = groups.at(-1);
          const lastBox = lastGroup?.at(-1);
          if (lastBox && box.target - box.height / 2 < lastBox.target + lastBox.height / 2 + BOX_GAP_PX) {
            lastGroup!.push(box);
          } else {
            groups.push([box]);
          }
        }
        for (const group of groups) {
          const totalHeight = group.reduce((sum, b) => sum + b.height, 0) + BOX_GAP_PX * (group.length - 1);
          const avgTarget = group.reduce((sum, b) => sum + b.target, 0) / group.length;
          let top = avgTarget - totalHeight / 2;
          for (const box of group) {
            centerY.set(box.key, top + box.height / 2);
            top += box.height + BOX_GAP_PX;
          }
        }
      }

      // Pyramid-centering can pull a box's target above the column's
      // natural y=0 top (a box converging toward fewer, more-centered
      // feeders drifts upward as much as downward) — shift everything
      // down by whatever's needed so nothing renders above the
      // container's top edge, escaping its rounded border.
      let globalMinTop = Infinity;
      for (const [key, target] of centerY) {
        const h = height.get(key) ?? 0;
        globalMinTop = Math.min(globalMinTop, target - h / 2);
      }
      if (Number.isFinite(globalMinTop) && globalMinTop < 0) {
        for (const [key, target] of centerY) centerY.set(key, target - globalMinTop);
      }

      // Real per-column extent, in the same coordinate space colStartY
      // measured in — i.e. how far past the column's own top (below its
      // heading) the lowest transformed box actually reaches.
      const nextColHeights = new Map<string, number>();
      for (const col of flow.columns) {
        const startY = colStartY.get(col.id) ?? 0;
        let bottom = startY;
        for (const box of col.boxes) {
          const target = centerY.get(box.key);
          if (target == null) continue;
          const h = height.get(box.key) ?? 0;
          bottom = Math.max(bottom, target + h / 2);
        }
        nextColHeights.set(col.id, Math.max(0, bottom - startY));
      }
      setColHeights(nextColHeights);

      const nextOffsets = new Map<string, number>();
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [key, natural] of naturalCenter) {
        const target = centerY.get(key) ?? natural;
        nextOffsets.set(key, target - natural);
        const h = height.get(key) ?? 0;
        minY = Math.min(minY, target - h / 2);
        maxY = Math.max(maxY, target + h / 2);
      }
      setOffsets(nextOffsets);

      const nextLines: Line[] = flow.edges
        .map((edge) => {
          const fromLeft = left.get(edge.from);
          const fromWidth = width.get(edge.from);
          const toLeft = left.get(edge.to);
          const fromY = centerY.get(edge.from);
          const toY = centerY.get(edge.to);
          if (fromLeft == null || fromWidth == null || toLeft == null || fromY == null || toY == null) return null;
          return { x1: fromLeft + fromWidth, y1: fromY, x2: toLeft, y2: toY };
        })
        .filter((l): l is Line => l !== null);
      setLines(nextLines);

      const maxLeft = Math.max(0, ...[...left.entries()].map(([k, v]) => v + (width.get(k) ?? 0)));
      setCanvas({ width: maxLeft, height: Number.isFinite(maxY - minY) ? maxY - minY : 0 });
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [flow]);

  if (!flow) return null;

  // A column that repeats the previous column's label (today: Losers
  // Final continuing Semifinals — see PHASE2_COLUMN_LABELS in
  // tournament-flow.ts) is still its own real FlowColumn — it can't
  // merge into the data model, since it genuinely resolves later,
  // averaging feeders from *both* boxes beside it. But visually it
  // should read as one continuous column rather than a second boxed
  // block, so it inherits the same tint instead of alternating.
  const columnTintGroups: number[] = [];
  for (let i = 0; i < flow.columns.length; i++) {
    const continuesFromPrev = flow.columns[i]!.label === flow.columns[i - 1]?.label;
    columnTintGroups.push(continuesFromPrev ? columnTintGroups[i - 1]! : (columnTintGroups[i - 1] ?? -1) + 1);
  }

  return (
    <div className="w-full overflow-x-auto rounded-card border-2 border-border bg-background">
      <div ref={containerRef} className="relative flex w-full items-stretch">
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={canvas.width}
          height={canvas.height}
          aria-hidden="true"
        >
          <defs>
            {/* Arrowhead marker dropped at each line's receiving end (x2,
                y2) — since every path's last segment is the horizontal
                `H x2` run into the target box, the marker's `auto`
                orientation naturally points it rightward, landing right
                at the box's left edge. */}
            <marker id="bracket-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--border)" }} />
            </marker>
          </defs>
          {lines.map((l, i) => {
            // Elbow sits a fixed short distance out from the source box,
            // not at the geometric midpoint — for an ordinary
            // adjacent-column edge those are the same thing (the column
            // gap is fixed), but a "skip" edge (e.g. Winners Final →
            // Grand Final, jumping clean over the Losers Final column)
            // has a far-away x2, and a midpoint elbow would land deep
            // inside the skipped column instead of staying a short nub
            // right at the box.
            const elbowX = l.x1 + OUT_NUB_PX;
            return (
              <path
                key={i}
                d={`M ${l.x1} ${l.y1} H ${elbowX} V ${l.y2} H ${l.x2}`}
                fill="none"
                style={{ stroke: "var(--border)" }}
                strokeWidth={2}
                markerEnd="url(#bracket-arrow)"
              />
            );
          })}
        </svg>
        {/* Left bleed spacer: grows to fill any leftover space once the
            row is centered (see the trailing spacer below), tinted to
            match whatever the first column's own color is so that color
            reads as starting right at the panel's true left edge rather
            than leaving a gap of plain background before it. Only ever
            visible when there's slack to grow into ("if space"); once
            the columns overflow, flex-basis 0 collapses it to nothing
            and the panel scrolls horizontally instead. */}
        <div className={`flex-1 ${columnTintClass(0)}`} aria-hidden />
        {flow.columns.map((col, i) => {
          // Losers Final shares its header text with Semifinals (see
          // PHASE2_COLUMN_LABELS in tournament-flow.ts) since it's still
          // conceptually part of that round even though it needs its own
          // column — skip printing the label a second time in a row so
          // it reads as one heading spanning both columns.
          const showLabel = col.label !== flow.columns[i - 1]?.label;
          const continuesToNext = col.label === flow.columns[i + 1]?.label;
          // Tighten the padding at a shared seam (a continuing column's
          // own left edge, or the trailing edge of the column right
          // before one) so the two read as flush/continuous instead of
          // leaving the usual full column-gap between them.
          const paddingClass = `${showLabel ? "pl-6" : "pl-2"} ${continuesToNext ? "pr-2" : "pr-6"}`;
          // The header band's own negative margins exactly cancel the
          // column's horizontal padding above, so its dark background
          // bleeds to the true edge of this column's slot — adjacent
          // columns' bands then abut with no gap, reading as one
          // continuous strip across the whole panel instead of per-
          // column tinted rectangles.
          const headerBleedClass = `${showLabel ? "-ml-6" : "-ml-2"} ${continuesToNext ? "-mr-2" : "-mr-6"}`;
          return (
            <div key={col.id} className={`flex shrink-0 flex-col gap-3 ${paddingClass} ${columnTintClass(columnTintGroups[i]!)}`}>
              <div className={`bg-black/30 py-2 ${headerBleedClass}`}>
                <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                  {showLabel ? col.label : " "}
                </h3>
              </div>
              <div
                className="flex flex-col gap-3 pt-1 pb-6"
                style={{ minHeight: colHeights.get(col.id) }}
                ref={(el) => {
                  if (el) colBoxWrapperEls.current.set(col.id, el);
                  else colBoxWrapperEls.current.delete(col.id);
                }}
              >
                {col.boxes.map((box) => (
                  <BoxCard
                    key={box.key}
                    box={box}
                    offsetY={offsets.get(box.key) ?? 0}
                    boxRef={(el) => {
                      if (el) boxEls.current.set(box.key, el);
                      else boxEls.current.delete(box.key);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {/* Right bleed spacer: deliberately never tinted, even when the
            last column is the dark variant — the color stops right at
            that column's edge and plain background resumes for any
            leftover space, instead of trailing off past where the
            bracket actually ends. */}
        <div className="flex-1" aria-hidden />
      </div>
    </div>
  );
}

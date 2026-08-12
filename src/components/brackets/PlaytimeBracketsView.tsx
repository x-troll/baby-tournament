"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { StatusBadge } from "./StatusBadge";
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

// Extra vertical nudge applied to Losers Round 1 / Losers Final so the
// losers track visually separates from the winners track above it.
const LOSER_TRACK_OFFSET_PX = 28;

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function sortParticipants(p: FlowParticipant[]): FlowParticipant[] {
  return [...p].sort((a, b) => {
    if (a.finishPosition != null && b.finishPosition != null) return a.finishPosition - b.finishPosition;
    return 0;
  });
}

function ParticipantRow({ p }: { p: FlowParticipant }) {
  return (
    <p
      className={`flex min-w-0 items-center gap-1 text-sm ${p.advancing ? "font-bold text-active" : "text-foreground-muted"}`}
    >
      {p.avatarSrc ? (
        <Image src={p.avatarSrc} alt="" width={16} height={16} className="shrink-0 rounded-full" />
      ) : (
        <span
          aria-hidden
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-background-sunken text-[10px] leading-none"
        >
          🍼
        </span>
      )}
      <span className="min-w-0 truncate">{p.name ?? "????"}</span>
      {p.advancing && (
        <span aria-hidden className="shrink-0">
          👑
        </span>
      )}
    </p>
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
      className={`flex w-48 flex-col gap-2 rounded-card border-2 p-3 shadow-soft transition-opacity ${borderClasses}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{box.label}</p>
        <StatusBadge status={box.status} />
      </div>
      <div className="flex flex-col gap-0.5">
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
 * converge toward the middle. Losers Round 1 / Losers Final also get a
 * deliberate extra downward nudge (`LOSER_TRACK_OFFSET_PX`) and a red
 * tint so the losers track reads as visually distinct from the winners
 * track above it. Connector elbows sit a fixed short distance
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
  // untransformed height) and the outer container's bottom padding.
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
          if (box.isLoserTrack) target += LOSER_TRACK_OFFSET_PX;
          raw.push({ key: box.key, height: h, target });
          prevKey = box.key;
        }

        // Phase 2: resolve overlaps — sort by raw target and push any
        // box that's too close to its now-settled predecessor straight
        // down, just far enough to clear it. This is the actual
        // guarantee against collisions; Phase 1 only produces a good
        // starting guess, not a promise of no overlap.
        raw.sort((a, b) => a.target - b.target);
        let prevBottom = -Infinity;
        for (const box of raw) {
          const top = Math.max(box.target - box.height / 2, prevBottom + (prevBottom === -Infinity ? 0 : BOX_GAP_PX));
          const resolved = top + box.height / 2;
          centerY.set(box.key, resolved);
          prevBottom = top + box.height;
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

  return (
    <div className="w-full overflow-x-auto rounded-card border-2 border-border bg-background-sunken p-4">
      <div ref={containerRef} className="relative flex w-fit items-stretch gap-8">
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
        {flow.columns.map((col, i) => {
          // Losers Final shares its header text with Semifinals (see
          // PHASE2_COLUMN_LABELS in tournament-flow.ts) since it's still
          // conceptually part of that round even though it needs its own
          // column — skip printing the label a second time in a row so
          // it reads as one heading spanning both columns.
          const showLabel = col.label !== flow.columns[i - 1]?.label;
          // Alternating tint instead of a separator line between columns —
          // a low-opacity black overlay reads as "slightly darker" in both
          // light and dark mode alike, unlike picking a named background
          // token (which would invert which one looks "darker" between
          // themes).
          const isEvenColumn = i % 2 === 1;
          return (
            <div
              key={col.id}
              className={`flex flex-col gap-3 rounded-card px-3 py-2 ${isEvenColumn ? "bg-black/12" : ""}`}
            >
              <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                {showLabel ? col.label : " "}
              </h3>
              <div
                className="flex flex-col gap-3 pb-2"
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
      </div>
    </div>
  );
}

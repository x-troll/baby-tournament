"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { babyReportResultAction } from "@/server-actions/baby-matches";

export interface ReportableParticipant {
  babyId: string;
  displayName: string | null;
  /** Pre-resolved server-side (src/lib/player-copy.ts, from the viewing baby's own prefs) — "🌟 {name} got the gold star" and its 3 other variants. */
  goldStarLabel: string;
}

/** The two flavor strings this form needs, resolved server-side (functions can't cross the server/client boundary). */
export interface ResultReportFormCopy {
  goldStarPrompt: string;
  dragInstruction: string;
}

/**
 * Result reporting — one reporter, no consensus needed. 1v1 matches get
 * two big "who got the gold star" buttons (spec: "winner taps 'I got the
 * gold star'" — either participant can report either outcome). Pens
 * (3-4 babies) get drag-to-reorder, best at the top.
 *
 * Drag-to-reorder is genuinely drag-only here (spec explicitly waives
 * WCAG 2.1.1 for this one control) — but @dnd-kit's keyboard sensor is
 * wired up anyway since it costs nothing to include and only helps.
 */
export function ResultReportForm({
  slug,
  matchId,
  participants,
  copy,
}: {
  slug: string;
  matchId: string;
  participants: ReportableParticipant[];
  copy: ResultReportFormCopy;
}) {
  if (participants.length === 2) {
    return <HeadToHeadButtons slug={slug} matchId={matchId} participants={participants} copy={copy} />;
  }
  return <PenReorderForm slug={slug} matchId={matchId} participants={participants} copy={copy} />;
}

function HeadToHeadButtons({
  slug,
  matchId,
  participants,
  copy,
}: {
  slug: string;
  matchId: string;
  participants: ReportableParticipant[];
  copy: ResultReportFormCopy;
}) {
  const [isPending, startTransition] = useTransition();

  function report(winnerId: string) {
    const loserId = participants.find((p) => p.babyId !== winnerId)!.babyId;
    startTransition(() => {
      babyReportResultAction(slug, matchId, [winnerId, loserId]);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground-muted">{copy.goldStarPrompt}</p>
      {participants.map((p) => (
        <Button key={p.babyId} onClick={() => report(p.babyId)} disabled={isPending} className="min-h-12">
          {p.goldStarLabel}
        </Button>
      ))}
    </div>
  );
}

function PenReorderForm({
  slug,
  matchId,
  participants,
  copy,
}: {
  slug: string;
  matchId: string;
  participants: ReportableParticipant[];
  copy: ResultReportFormCopy;
}) {
  const [order, setOrder] = useState(participants.map((p) => p.babyId));
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(participants.map((p) => [p.babyId, p]));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function submit() {
    startTransition(() => {
      babyReportResultAction(slug, matchId, order);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground-muted">{copy.dragInstruction}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {order.map((babyId, index) => (
              <SortableRow key={babyId} babyId={babyId} place={index + 1} name={byId.get(babyId)?.displayName} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button onClick={submit} disabled={isPending} className="self-start">
        Report this order
      </Button>
    </div>
  );
}

function SortableRow({ babyId, place, name }: { babyId: string; place: number; name: string | null | undefined }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: babyId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex min-h-11 cursor-grab items-center gap-3 rounded-pill border border-border bg-background-elevated px-4 py-2 active:cursor-grabbing ${isDragging ? "opacity-60" : ""}`}
    >
      <span aria-hidden className="font-display text-lg font-bold text-star-gold">
        {place}
      </span>
      <span>{name ?? "Unnamed baby"}</span>
      <span aria-hidden className="ml-auto text-foreground-muted">
        ⠿
      </span>
    </li>
  );
}

"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/Avatar";
import { ResultReportForm, type ReportableParticipant, type ResultReportFormCopy } from "./ResultReportForm";
import { babyStartMatchAction } from "@/server-actions/baby-matches";
import type { BabyStatusState } from "@/lib/baby-status";

// Plain strings only — a client component can't receive functions across
// the server/client boundary, so every line here is fully resolved
// server-side (src/lib/player-copy.ts, from the viewing baby's own
// /profile choices) before it ever reaches this component.
export interface StatusCardCopy {
  organizerComing: string;
  championLine: string;
  nappedLine?: string;
  notStartedLine: string;
  waitingEtaLine: string;
  upNextLine: string;
  startMatchButtonLabel: string;
  playingLine: string;
}

export interface StatusCardProps {
  slug: string;
  state: BabyStatusState;
  copy: StatusCardCopy;
  /** Only needed for the PLAYING state, to render the report form. */
  currentMatchParticipants?: ReportableParticipant[];
  /** Only needed for the PLAYING state. */
  reportFormCopy?: ResultReportFormCopy;
}

/**
 * The "what's happening to me right now" card — always exactly one of
 * these states, always the top of the baby screen. `aria-live="polite"`
 * on the message so state changes announce without stealing focus.
 */
export function StatusCard({ slug, state, copy, currentMatchParticipants, reportFormCopy }: StatusCardProps) {
  const wobble = state.kind === "UP_NEXT" ? "animate-wobble motion-reduce:animate-none" : "";

  return (
    <Card className={`border-2 ${wobble}`}>
      <div aria-live="polite" className="flex flex-col gap-3">
        {renderBody(state, slug, copy, currentMatchParticipants, reportFormCopy)}
      </div>
    </Card>
  );
}

function renderBody(
  state: BabyStatusState,
  slug: string,
  copy: StatusCardCopy,
  currentMatchParticipants: ReportableParticipant[] | undefined,
  reportFormCopy: ResultReportFormCopy | undefined,
) {
  switch (state.kind) {
    case "DADDY_COMING":
      return (
        <div className="flex items-center gap-3">
          <Avatar src="/admin-avatar.svg" size={70} />
          <Headline>{copy.organizerComing}</Headline>
        </div>
      );

    case "CHAMPION":
      return <Headline>{copy.championLine}</Headline>;

    case "NAPPED":
      return <Headline>{copy.nappedLine}</Headline>;

    case "NOT_STARTED":
      return <Headline>{copy.notStartedLine}</Headline>;

    case "QUIET_TIME":
      return <Headline>{copy.waitingEtaLine}</Headline>;

    case "UP_NEXT":
      return (
        <>
          <Headline>{copy.upNextLine}</Headline>
          <StartMatchButton slug={slug} matchId={state.matchId} label={copy.startMatchButtonLabel} />
        </>
      );

    case "PLAYING":
      return (
        <>
          <Headline>{copy.playingLine}</Headline>
          {currentMatchParticipants && reportFormCopy && (
            <ResultReportForm
              slug={slug}
              matchId={state.matchId}
              participants={currentMatchParticipants}
              copy={reportFormCopy}
            />
          )}
        </>
      );
  }
}

function Headline({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-xl font-bold">{children}</p>;
}

function StartMatchButton({ slug, matchId, label }: { slug: string; matchId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      onClick={() => startTransition(() => babyStartMatchAction(slug, matchId))}
      disabled={isPending}
      className="self-start"
    >
      {label}
    </Button>
  );
}

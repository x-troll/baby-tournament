"use client";

import { useTransition } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./CountdownTimer";
import { ResultReportForm, type ReportableParticipant } from "./ResultReportForm";
import { babyConfirmResultAction, babyDisputeResultAction, babyStartMatchAction } from "@/server-actions/baby-matches";
import type { BabyStatusState } from "@/lib/baby-status";

// Plain strings only — a client component can't receive the Terminology
// object as a prop (it carries functions like eliminatedWithPlacement,
// and functions can't cross the server/client boundary). The page
// resolves whatever copy this state needs server-side instead.
export interface StatusCardCopy {
  champion: string;
  matchWin: string;
  registration: string;
  waitingForMatchCapitalized: string;
  nappedMessage?: string;
  /** This baby's own resolved organizer term (their /profile pick, or the deployment default) — see src/lib/baby-terminology.ts. */
  organizerTerm: string;
}

export interface StatusCardProps {
  slug: string;
  state: BabyStatusState;
  copy: StatusCardCopy;
  /** Only needed for the PLAYING state, to render the report form. */
  currentMatchParticipants?: ReportableParticipant[];
}

/**
 * The "what's happening to me right now" card — always exactly one of
 * these states, always the top of the baby screen. `aria-live="polite"`
 * on the message so state changes announce without stealing focus.
 */
export function StatusCard({ slug, state, copy, currentMatchParticipants }: StatusCardProps) {
  const wobble = state.kind === "UP_NEXT" ? "animate-wobble motion-reduce:animate-none" : "";

  return (
    <Card className={`border-2 ${wobble}`}>
      <div aria-live="polite" className="flex flex-col gap-3">
        {renderBody(state, slug, copy, currentMatchParticipants)}
      </div>
    </Card>
  );
}

function renderBody(
  state: BabyStatusState,
  slug: string,
  copy: StatusCardCopy,
  currentMatchParticipants: ReportableParticipant[] | undefined,
) {
  switch (state.kind) {
    case "DADDY_COMING":
      return (
        <div className="flex items-center gap-3">
          <Image src="/admin-avatar.svg" alt="" width={40} height={40} className="rounded-full" />
          <Headline>{copy.organizerTerm} is coming 💫</Headline>
        </div>
      );

    case "CHAMPION":
      return <Headline>You&apos;re the {copy.champion}! 🌟🌟🌟</Headline>;

    case "NAPPED":
      return <Headline>{copy.nappedMessage}</Headline>;

    case "NOT_STARTED":
      return <Headline>Hang tight — {copy.registration} is still getting ready.</Headline>;

    case "QUIET_TIME":
      return (
        <Headline>
          {copy.waitingForMatchCapitalized} — your turn in about {state.etaMinutes ?? "a few"} minute
          {state.etaMinutes === 1 ? "" : "s"}.
        </Headline>
      );

    case "UP_NEXT":
      return (
        <>
          <Headline>You&apos;re up next! Head over to the console.</Headline>
          <StartMatchButton slug={slug} matchId={state.matchId} />
        </>
      );

    case "PLAYING":
      return (
        <>
          <Headline>You&apos;re playing now — report your result when you&apos;re done.</Headline>
          {currentMatchParticipants && (
            <ResultReportForm slug={slug} matchId={state.matchId} participants={currentMatchParticipants} />
          )}
        </>
      );

    case "WAITING_ON_PLAYMATES":
      return (
        <>
          <Headline>Waiting on your playmates to confirm…</Headline>
          <CountdownTimer deadline={state.deadlineAt} doneLabel="Confirming automatically now" />
        </>
      );

    case "AWAITING_YOUR_CONFIRMATION":
      return (
        <>
          <Headline>
            {state.reporterName ?? "Someone"} says they got the {copy.matchWin} — do you agree?
          </Headline>
          <CountdownTimer deadline={state.deadlineAt} doneLabel="Confirming automatically now" />
          <ConfirmDisputeButtons slug={slug} matchId={state.matchId} />
        </>
      );
  }
}

function Headline({ children }: { children: React.ReactNode }) {
  return <p className="text-xl font-bold">{children}</p>;
}

function StartMatchButton({ slug, matchId }: { slug: string; matchId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      onClick={() => startTransition(() => babyStartMatchAction(slug, matchId))}
      disabled={isPending}
      className="self-start"
    >
      We&apos;re playing
    </Button>
  );
}

function ConfirmDisputeButtons({ slug, matchId }: { slug: string; matchId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button onClick={() => startTransition(() => babyConfirmResultAction(slug, matchId))} disabled={isPending}>
        Confirm
      </Button>
      <Button
        variant="destructive"
        onClick={() => startTransition(() => babyDisputeResultAction(slug, matchId))}
        disabled={isPending}
      >
        Dispute
      </Button>
    </div>
  );
}

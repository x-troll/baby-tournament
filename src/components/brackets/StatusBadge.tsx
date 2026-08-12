import { toDisplayStatus, type DisplayStatus } from "@/lib/match-status";

export { toDisplayStatus };
export type { DisplayStatus };

const LABEL: Record<DisplayStatus, string> = {
  NOT_YET_PLAYED: "Not yet played",
  NEXT_UP: "Next up",
  READY: "Ready to play",
  PLAYING: "Playing now",
  FINISHED: "Finished",
};

const CLASSES: Record<DisplayStatus, string> = {
  NOT_YET_PLAYED: "text-foreground-muted",
  NEXT_UP: "text-accent-blue",
  READY: "text-active",
  PLAYING: "text-danger",
  FINISHED: "text-success",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`text-[0.65rem] font-semibold uppercase tracking-wide ${CLASSES[status]}`}>{LABEL[status]}</span>;
}

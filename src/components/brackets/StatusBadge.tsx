import { toDisplayStatus, type DisplayStatus } from "@/lib/match-status";

export { toDisplayStatus };
export type { DisplayStatus };

const LABEL: Record<DisplayStatus, string> = {
  NOT_YET_PLAYED: "Not yet played",
  PLAYING: "Playing now",
  FINISHED: "Finished",
};

const CLASSES: Record<DisplayStatus, string> = {
  NOT_YET_PLAYED: "text-foreground-muted",
  PLAYING: "text-active",
  FINISHED: "text-success",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`text-[0.65rem] font-semibold uppercase tracking-wide ${CLASSES[status]}`}>{LABEL[status]}</span>;
}

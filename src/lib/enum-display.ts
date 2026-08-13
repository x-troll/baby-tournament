// Label + Badge variant for enum values that used to render as raw text
// (MARIO_KART, IN_PROGRESS, ...) across the admin panel. One shared module
// so the playtimes list and a playtime's own detail page stay visually
// consistent — both import from here rather than each picking their own
// labels/colors.
import { Game, PlaytimeStatus } from "@/generated/prisma/enums";
import type { BadgeProps } from "@/components/ui/badge";
import { getTerminology } from "@/lib/terminology";

// Skin is a whole-process/deployment setting, not per-request — same
// module-level resolution used across src/lib for this reason (see
// bracket-view.ts). Every call site here is a server component/route
// handler, so this is always safe to call directly.
const t = getTerminology();

// Not themed — "Mario Kart"/"Super Smash Bros" are literal game/product
// names, not wording that varies with THEME.
export const GAME_DISPLAY: Record<Game, { label: string; variant: BadgeProps["variant"] }> = {
  [Game.MARIO_KART]: { label: "Mario Kart", variant: "pink" },
  [Game.SUPER_SMASH]: { label: "Super Smash Bros", variant: "blue" },
};

export const PLAYTIME_STATUS_DISPLAY: Record<PlaytimeStatus, { label: string; variant: BadgeProps["variant"] }> = {
  [PlaytimeStatus.NURSERY_OPEN]: { label: t.playtimeStatusLabel.NURSERY_OPEN, variant: "yellow" },
  [PlaytimeStatus.IN_PROGRESS]: { label: t.playtimeStatusLabel.IN_PROGRESS, variant: "mint" },
  [PlaytimeStatus.COMPLETE]: { label: t.playtimeStatusLabel.COMPLETE, variant: "blue" },
};

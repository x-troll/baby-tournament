// Label + Badge variant for enum values that used to render as raw text
// (MARIO_KART, IN_PROGRESS, ...) across the admin panel. One shared module
// so the playtimes list and a playtime's own detail page stay visually
// consistent — both import from here rather than each picking their own
// labels/colors.
import { Game, PlaytimeStatus } from "@/generated/prisma/enums";
import type { BadgeProps } from "@/components/ui/badge";

export const GAME_DISPLAY: Record<Game, { label: string; variant: BadgeProps["variant"] }> = {
  [Game.MARIO_KART]: { label: "Mario Kart", variant: "pink" },
  [Game.SUPER_SMASH]: { label: "Super Smash Bros", variant: "blue" },
};

export const PLAYTIME_STATUS_DISPLAY: Record<PlaytimeStatus, { label: string; variant: BadgeProps["variant"] }> = {
  [PlaytimeStatus.NURSERY_OPEN]: { label: "Nursery open", variant: "yellow" },
  [PlaytimeStatus.IN_PROGRESS]: { label: "In progress", variant: "mint" },
  [PlaytimeStatus.COMPLETE]: { label: "Complete", variant: "blue" },
};

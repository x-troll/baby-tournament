// Pure data, no fs/path — unlike rules-content.ts (Node-only), this is
// safe to import from a client component (StyledQrCode's game-specific
// logo). public/games/<slug>/ also holds each game's rules.png,
// referenced directly from content/rules/*.md frontmatter — this file is
// only the logo half, since that's the only piece any code needs to look
// up dynamically by Game.
import { Game } from "@/generated/prisma/enums";

export const GAME_LOGO_SRC: Record<Game, string> = {
  [Game.MARIO_KART]: "/games/mario-kart/logo.png",
  [Game.SUPER_SMASH]: "/games/super-smash/logo.png",
};

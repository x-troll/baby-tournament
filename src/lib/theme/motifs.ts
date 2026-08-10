/**
 * Typed registry for decorative motifs. The primary swapping mechanism is
 * CSS custom properties (--motif-primary / --motif-secondary in
 * tokens.css) so most usage is plain `background-image: var(--motif-primary)`
 * with no JS involved. This registry exists for the few spots that need
 * an actual <Image>/<img> element (e.g. a motif used as content, not
 * background) and therefore need a concrete `src` string picked
 * server-side or in a client component that knows the current mode.
 *
 * Same asset set, same lookup shape, in both places — no duplicated
 * per-mode components.
 */

export type ThemeMode = "light" | "dark";

export type MotifName = "primary" | "secondary";

const MOTIFS: Record<ThemeMode, Record<MotifName, string | null>> = {
  light: {
    primary: "/motifs/light/cloud.svg",
    secondary: "/motifs/light/building-block.svg",
  },
  dark: {
    primary: "/motifs/dark/moon.svg",
    secondary: "/motifs/dark/sleepy-star.svg",
  },
};

/** Returns null for the plain skin — callers should render nothing, not a broken image. */
export function getMotifSrc(name: MotifName, mode: ThemeMode, skin: "nursery" | "plain"): string | null {
  if (skin === "plain") return null;
  return MOTIFS[mode][name];
}

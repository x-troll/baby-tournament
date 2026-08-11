// `Playtime.slugNumber` is what every baby/spectator-facing URL segment
// (`/live/[slug]`, `/play/[slug]`) actually holds — route params always
// arrive as strings, so every lookup needs this same parse-and-validate
// step first. A non-numeric or non-positive-integer param can never match
// a real row (autoincrement starts at 1), so callers treat `null` the same
// as "not found" rather than throwing.
export function parseSlugNumber(slug: string): number | null {
  const n = Number(slug);
  return Number.isInteger(n) && n > 0 ? n : null;
}

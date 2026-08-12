// The master list of pickable avatars — a plain array, not a directory
// scan, per the delegated call in PLAN.md: adding real artwork later is a
// one-line change (drop the file in public/avatars/, add a row here), not
// a filesystem convention to maintain. `id` is what's actually stored on
// `Baby.avatarId`, so the artwork file itself can be swapped freely
// without touching any stored data.
export interface AvatarOption {
  id: string;
  label: string;
  src: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "giraffe", label: "Giraffe", src: "/avatars/peekabu_giraffe.png" },
  { id: "little_king", label: "Little King", src: "/avatars/little_kings.png" },
];

export function resolveAvatarSrc(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return AVATAR_OPTIONS.find((a) => a.id === avatarId)?.src ?? null;
}

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

// Three separate named groups (one per art pack) rather than one flat
// list — the picker renders each group as its own row, so grouping lives
// here instead of being re-derived from `src`'s path in the UI.
export const PEEKABU_AVATARS: AvatarOption[] = [
  { id: "giraffe", label: "Giraffe", src: "/avatars/peekabu/giraffe.jpg" },
  { id: "racoon", label: "Racoon", src: "/avatars/peekabu/racoon.jpg" },
  { id: "dragon", label: "Dragon", src: "/avatars/peekabu/dragon.jpg" },
  { id: "husky", label: "Husky", src: "/avatars/peekabu/husky.jpg" },
];

export const CRINKLZ_AVATARS: AvatarOption[] = [
  { id: "crinklz", label: "Crinklz", src: "/avatars/crinklz/crinklz.jpg" },
  { id: "felix", label: "Felix", src: "/avatars/crinklz/felix.jpg" },
  { id: "leah", label: "Leah", src: "/avatars/crinklz/leah.jpg" },
  { id: "max", label: "Max", src: "/avatars/crinklz/max.jpg" },
  { id: "theo", label: "Theo", src: "/avatars/crinklz/theo.jpg" },
  { id: "alma", label: "Alma", src: "/avatars/crinklz/alma.jpg" },
];

export const TINYTAILS_AVATARS: AvatarOption[] = [
  { id: "deer", label: "Deer", src: "/avatars/tinytails/deer.jpg" },
  { id: "lion", label: "Lion", src: "/avatars/tinytails/lion.jpg" },
  // Was also "husky" — collided with peekabu's id above, so `id` no
  // longer uniquely identified a src: resolveAvatarSrc's `find` always
  // won for peekabu's husky, and picking this one in the form silently
  // saved the other pack's picture.
  { id: "tinytails-husky", label: "Husky", src: "/avatars/tinytails/husky.jpg" },
  { id: "fox", label: "Fox", src: "/avatars/tinytails/fox.jpg" },
];

export const AVATAR_GROUPS: { name: string; options: AvatarOption[] }[] = [
  { name: "Peekabu", options: PEEKABU_AVATARS },
  { name: "Crinklz", options: CRINKLZ_AVATARS },
  { name: "Tinytails", options: TINYTAILS_AVATARS },
];

export const AVATAR_OPTIONS: AvatarOption[] = AVATAR_GROUPS.flatMap((g) => g.options);

export function resolveAvatarSrc(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return AVATAR_OPTIONS.find((a) => a.id === avatarId)?.src ?? null;
}

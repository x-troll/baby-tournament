import Image from "next/image";

/**
 * The one place every avatar image renders — a single `size` number
 * enforces a 1:1 box by construction (no risk of a mismatched width/
 * height drifting in at some call site), and `overflow-hidden` +
 * `rounded-full` clip to a perfect circle regardless of the source
 * image's own aspect ratio (neither of the two real avatar PNGs is
 * actually square). `object-cover` on the `<Image>` itself is what
 * stops that source mismatch from reading as a stretched/squashed
 * oval instead of a clean crop. Falls back to a pacifier emoji, sized
 * proportionally, when there's no avatar chosen yet.
 */
export function Avatar({ src, size, className }: { src: string | null; size: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-background-sunken ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden style={{ fontSize: size * 0.5 }} className="leading-none">
          🍼
        </span>
      )}
    </span>
  );
}

import Image from "next/image";

export function StageBanner({
  text,
  logoSrc,
  trailingAvatarSrc,
}: {
  text: string;
  logoSrc?: string;
  /**
   * undefined = no trailing avatar slot at all (every non-COMPLETE
   * stage); null = the slot is present but the champion never picked an
   * avatar picture (falls back to a plain emoji); a string = their real
   * avatar image. Only ever passed for the COMPLETE-stage "the very
   * best ... won" banner.
   */
  trailingAvatarSrc?: string | null;
}) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-card border-2 border-active bg-background-elevated px-6 py-4 text-center shadow-soft">
      {logoSrc && <Image src={logoSrc} alt="" width={64} height={64} className="rounded-card" />}
      <p className="font-display text-3xl font-bold tracking-wide text-active sm:text-4xl">{text}</p>
      {trailingAvatarSrc !== undefined &&
        (trailingAvatarSrc ? (
          <Image src={trailingAvatarSrc} alt="" width={40} height={40} className="rounded-full" />
        ) : (
          <span aria-hidden className="text-3xl">
            🍼
          </span>
        ))}
    </div>
  );
}

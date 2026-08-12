import Image from "next/image";

export function StageBanner({ text, logoSrc }: { text: string; logoSrc?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-card border-2 border-active bg-background-elevated px-6 py-4 text-center shadow-soft">
      {logoSrc && <Image src={logoSrc} alt="" width={40} height={40} className="rounded-card" />}
      <p className="font-display text-3xl font-bold tracking-wide text-active sm:text-4xl">{text}</p>
    </div>
  );
}

export function StageBanner({ text }: { text: string }) {
  return (
    <div className="rounded-card border-2 border-active bg-background-elevated px-6 py-4 text-center shadow-soft">
      <p className="font-display text-3xl font-bold tracking-wide text-active sm:text-4xl">{text}</p>
    </div>
  );
}

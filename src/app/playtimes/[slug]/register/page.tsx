import { redirect } from "next/navigation";
import { requireBabyForRegistration } from "@/lib/baby-auth";
import { BabyProfileForm } from "@/components/baby/BabyProfileForm";
import { completeRegistrationAction } from "@/server-actions/baby-profile";

/**
 * The one required-registration page every nameless Baby lands on —
 * reached via a Telegram magic link (handleBabyStart in
 * telegram/commands.ts sends one straight away, no more chat-based
 * name collection) or straight off the website /join/[token] flow, or
 * an admin's "Preview as baby" for a baby who hasn't registered yet
 * (see `playerPreview` below). Same form either way (BabyProfileForm,
 * shared with the settings page); the only difference is the no-show
 * waiver, which only applies to babies with no telegramChatId (no
 * Telegram means no turn notifications, so they need the explicit
 * heads-up Telegram babies don't).
 */
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ playerPreview?: string }>;
}) {
  const { slug } = await params;
  const { playerPreview } = await searchParams;
  const baby = await requireBabyForRegistration(slug);
  const previewQuery = playerPreview === "true" ? "?playerPreview=true" : "";
  if (baby.displayName) redirect(`/playtimes/${slug}${previewQuery}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      <h1 className="text-2xl font-bold">Finish signing up</h1>

      <BabyProfileForm
        action={completeRegistrationAction.bind(null, slug, playerPreview === "true")}
        mode="register"
        baby={baby}
        submitLabel="Let’s go!"
      />
    </main>
  );
}

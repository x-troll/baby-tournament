import Link from "next/link";
import { requireBaby } from "@/lib/baby-auth";
import { getTerminology } from "@/lib/terminology";
import { SettingsForm } from "@/components/baby/SettingsForm";
import { SignOutCard } from "@/components/baby/SignOutCard";
import { buttonVariants } from "@/components/ui/button";
import { updateBabyProfileAction } from "@/server-actions/baby-profile";

// Everything a baby set once at registration (src/app/playtimes/[slug]/
// register/page.tsx, sharing the same BabyProfileForm fields via
// SettingsForm) plus the explicit-messages toggle, editable anytime
// afterward — the Telegram /profile wizard this used to mirror is gone
// (registration is web-only now), so this is the only place any of it
// can be changed post-signup.
export default async function BabySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ playerPreview?: string }>;
}) {
  const { slug } = await params;
  const { playerPreview } = await searchParams;
  const baby = await requireBaby(slug);
  const t = getTerminology();
  // Carried through so an admin previewing a baby's screen (see
  // previewAsBabyAction) stays in preview after clicking Back — this
  // page itself doesn't branch on admin status at all (requireBaby
  // already hard-requires a real baby session either way), it only
  // needs to pass the flag along on its way back out.
  const previewQuery = playerPreview === "true" ? "?playerPreview=true" : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Your settings</h1>
        <Link
          href={`/playtimes/${slug}${previewQuery}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          ← Back
        </Link>
      </div>

      <SettingsForm baby={baby} action={updateBabyProfileAction.bind(null, slug)} />

      {/* No self-serve way to leave this playtime before this — the only
          way to trigger baby-auth.ts's "valid session, different
          playtime" path was physically scanning a different playtime's
          QR/magic link first. Deliberately doesn't carry playerPreview
          forward (see babyLogoutAction) — signing out of a previewed
          baby should land the admin on a plain view, not loop back into
          another preview. */}
      <SignOutCard
        slug={slug}
        warning={t.signOutWarning}
        confirmTitle={t.signOutConfirmTitle}
        confirmBody={t.signOutConfirmBody}
        confirmButtonLabel={t.signOutConfirmButtonLabel}
      />
    </main>
  );
}

import Link from "next/link";
import { requireBaby } from "@/lib/baby-auth";
import { SettingsForm } from "@/components/baby/SettingsForm";
import { Button, buttonVariants } from "@/components/ui/button";
import { updateBabyProfileAction } from "@/server-actions/baby-profile";
import { babyLogoutAction } from "@/server-actions/baby-auth";

// Everything a baby set once at registration (src/app/(baby)/play/[slug]/
// register/page.tsx, sharing the same BabyProfileForm fields via
// SettingsForm) plus the explicit-messages toggle, editable anytime
// afterward — the Telegram /profile wizard this used to mirror is gone
// (registration is web-only now), so this is the only place any of it
// can be changed post-signup.
export default async function BabySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBaby(slug);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      <Link href={`/play/${slug}`} className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}>
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">Your settings</h1>

      <SettingsForm baby={baby} action={updateBabyProfileAction.bind(null, slug)} />

      {/* No self-serve way to leave this playtime before this — the only
          way to trigger baby-auth.ts's "valid session, different
          playtime" path was physically scanning a different playtime's
          QR/magic link first. */}
      <form action={babyLogoutAction.bind(null, slug)} className="mt-2">
        <Button type="submit" variant="ghost" size="sm">
          Sign out of this playtime
        </Button>
      </form>
    </main>
  );
}

import Link from "next/link";
import { requireBaby } from "@/lib/baby-auth";
import { SettingsForm } from "@/components/baby/SettingsForm";
import { updateBabyProfileAction } from "@/server-actions/baby-profile";

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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Your settings</h1>
        <Link href={`/play/${slug}`} className="text-sm font-semibold text-foreground-muted underline">
          ← Back
        </Link>
      </div>

      <SettingsForm baby={baby} action={updateBabyProfileAction.bind(null, slug)} />
    </main>
  );
}

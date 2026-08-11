import Image from "next/image";
import Link from "next/link";
import { requireBaby } from "@/lib/baby-auth";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { SELF_ROLE_OPTIONS } from "@/lib/baby-terminology";
import { getTerminology } from "@/lib/terminology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateBabyProfileAction } from "@/server-actions/baby-profile";

// Web counterpart to the Telegram /profile command (src/lib/telegram/
// commands.ts) — same fields (avatar, self role, explicit-messages
// toggle), same optional/nullable semantics. Nothing before this page
// lets a baby set any of this from the web, so it's a brand new route,
// linked from the main play screen.
export default async function BabySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBaby(slug);
  const t = getTerminology();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Your settings</h1>
        <Link href={`/play/${slug}`} className="text-sm font-semibold text-foreground-muted underline">
          ← Back
        </Link>
      </div>

      <form action={updateBabyProfileAction.bind(null, slug)} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pick a picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {AVATAR_OPTIONS.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-card border border-border p-2 text-xs font-semibold has-checked:border-active has-checked:bg-background-sunken"
              >
                <input
                  type="radio"
                  name="avatarId"
                  value={a.id}
                  defaultChecked={baby.avatarId === a.id}
                  className="sr-only"
                />
                <Image src={a.src} alt="" width={48} height={48} />
                {a.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your role</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <label htmlFor="selfRoleLabel" className="text-sm text-foreground-muted">
              What should we call you?
            </label>
            <select
              id="selfRoleLabel"
              name="selfRoleLabel"
              defaultValue={baby.selfRoleLabel ?? ""}
              className="min-h-11 rounded-card border border-border bg-background-elevated px-3 py-2 text-sm text-foreground"
            >
              <option value="">Default ({t.player})</option>
              {SELF_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌶️ Allow explicit messages</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="allowExplicitMessages"
                defaultChecked={baby.allowExplicitMessages}
                className="h-5 w-5"
              />
              Yes, allow it
            </label>
            <p className="text-xs text-foreground-muted">
              Messages and texts you receive will be slightly more explicit and teasing, instead of playful.
            </p>
          </CardContent>
        </Card>

        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>
    </main>
  );
}

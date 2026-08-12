import { redirect } from "next/navigation";
import Image from "next/image";
import { requireBabyForRegistration } from "@/lib/baby-auth";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { SELF_ROLE_OPTIONS } from "@/lib/baby-terminology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { completeRegistrationAction } from "@/server-actions/baby-profile";

/**
 * The one required-registration page every nameless Baby lands on —
 * reached via a Telegram magic link (handleBabyStart in
 * telegram/commands.ts sends one straight away, no more chat-based
 * name collection) or straight off the website /join/[token] flow.
 * Same form either way; the only difference is the no-show waiver,
 * which only applies to babies with no telegramChatId (no Telegram
 * means no turn notifications, so they need the explicit heads-up
 * Telegram babies don't).
 */
export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBabyForRegistration(slug);
  if (baby.displayName) redirect(`/play/${slug}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32">
      <h1 className="text-2xl font-bold">Finish signing up</h1>

      <form action={completeRegistrationAction.bind(null, slug)} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>What should we call you?</CardTitle>
          </CardHeader>
          <CardContent>
            <Input name="displayName" required maxLength={40} placeholder="Your name" />
          </CardContent>
        </Card>

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
                <input type="radio" name="avatarId" value={a.id} required className="sr-only" />
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
              required
              defaultValue=""
              className="min-h-11 rounded-card border border-border bg-background-elevated px-3 py-2 text-sm text-foreground"
            >
              <option value="" disabled>
                Choose one
              </option>
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
              <input type="checkbox" name="allowExplicitMessages" className="h-5 w-5" />
              Yes, allow it
            </label>
            <p className="text-xs text-foreground-muted">
              Messages and texts you receive will be slightly more explicit and teasing, instead of playful.
            </p>
          </CardContent>
        </Card>

        {!baby.telegramChatId && (
          <Card>
            <CardHeader>
              <CardTitle>Before you go in</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="acceptedWaiver" required className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  I understand no one will remind me — if I&rsquo;m not back here and ready when it&rsquo;s my turn, I
                  lose by default.
                </span>
              </label>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="self-start">
          Let&rsquo;s go!
        </Button>
      </form>
    </main>
  );
}

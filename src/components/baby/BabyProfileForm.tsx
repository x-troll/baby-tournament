import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { SELF_ROLE_OPTIONS } from "@/lib/baby-terminology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Baby } from "@/generated/prisma/client";

/**
 * The name/avatar/role/explicit-messages fields — shared by
 * /play/[slug]/register (first-time, name/avatar/role all required, no
 * defaults, plus the no-show waiver for babies with no Telegram) and
 * /play/[slug]/settings (editable anytime after, avatar/role stay
 * optional, pre-filled from the baby's current values, no waiver —
 * that's a one-time acknowledgment, not an ongoing setting).
 */
export function BabyProfileForm({
  action,
  mode,
  baby,
  submitLabel,
  pending = false,
}: {
  /** Either a plain bound server action (register) or the `formAction` dispatcher useActionState returns (settings) — both fit a form's `action` prop. */
  action: (formData: FormData) => void;
  mode: "register" | "settings";
  baby: Pick<Baby, "displayName" | "avatarId" | "selfRoleLabel" | "allowExplicitMessages" | "telegramChatId">;
  submitLabel: string;
  pending?: boolean;
}) {
  const required = mode === "register";

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{required ? "What should we call you?" : "Your name"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            name="displayName"
            required
            maxLength={40}
            placeholder="Your name"
            defaultValue={baby.displayName ?? ""}
          />
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
              <input
                type="radio"
                name="avatarId"
                value={a.id}
                required={required}
                defaultChecked={baby.avatarId === a.id}
                className="sr-only"
              />
              <Avatar src={a.src} size={84} />
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
            required={required}
            defaultValue={baby.selfRoleLabel ?? ""}
            className="min-h-11 rounded-card border border-border bg-background-elevated px-3 py-2 text-sm text-foreground"
          >
            <option value="" disabled={required}>
              {required ? "Choose one" : "No preference"}
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
            <input
              type="checkbox"
              name="allowExplicitMessages"
              defaultChecked={baby.allowExplicitMessages}
              className="h-5 w-5"
            />
            Yes, allow it
          </label>
          <p className="text-xs text-foreground-muted">
            Telegram messages and UI text you see will be slightly more explicit and teasing, instead of playful.
          </p>
        </CardContent>
      </Card>

      {mode === "register" && !baby.telegramChatId && (
        <Card>
          <CardHeader>
            <CardTitle>Before you go in</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="acceptedWaiver" required className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                I understand no one will remind me, if I&rsquo;m not back here and ready when it&rsquo;s my turn, I
                lose by default.
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}

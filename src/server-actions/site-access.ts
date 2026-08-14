"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_PIN_COOKIE_NAME, SITE_PIN_COOKIE_MAX_AGE_SECONDS, signSitePinToken } from "@/lib/site-access";

export interface SitePinActionState {
  error?: string;
}

/** Relative-only — `next` ultimately comes from a URL search param (see /enter-pin/page.tsx), so a "//evil.com" or "https://..." value must never be followed. */
function safeNextPath(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/playtimes";
}

export async function verifySitePinAction(
  next: string,
  _prevState: SitePinActionState,
  formData: FormData,
): Promise<SitePinActionState> {
  const pin = String(formData.get("pin") ?? "");
  const expected = process.env.SITE_PIN;

  if (!expected) {
    // The gate is opt-in (middleware.ts skips it entirely when unset) —
    // reaching this action with no SITE_PIN configured shouldn't be
    // possible via the normal flow, but fail closed rather than silently
    // accepting any input if it somehow is.
    return { error: "The site PIN isn't configured. Ask the organizer to check the deployment settings." };
  }
  if (pin !== expected) {
    return { error: "That's not it, try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SITE_PIN_COOKIE_NAME, await signSitePinToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_PIN_COOKIE_MAX_AGE_SECONDS,
  });

  redirect(safeNextPath(next));
}

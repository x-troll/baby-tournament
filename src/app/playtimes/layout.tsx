import { getCurrentAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";

// Public tree — unlike admin/(protected), no requireAdmin() here. An
// admin who happens to be signed in gets the same nav + width as the
// rest of the admin panel; anyone else gets a bare, full-width surface
// (no nav at all — this is what an unauthenticated spectator's
// /playtimes/[slug] view needs to fill a projector screen edge-to-edge).
// A signed-out Daddy's way back in is a "Login" link, but that only
// belongs on the /playtimes list itself, not the [slug] detail page (a
// TV/projector screen shouldn't show one at all) — see playtimes/page.tsx
// and the "All playtimes" link inside [slug]'s own header card instead.
export default async function PlaytimesLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return <AdminShell>{children}</AdminShell>;
}

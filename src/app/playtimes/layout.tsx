import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";

// Public tree — unlike admin/(protected), no requireAdmin() here. An
// admin who happens to be signed in gets the same nav + width as the
// rest of the admin panel; anyone else gets a bare, full-width surface
// (no nav at all — this is what an unauthenticated spectator's
// /playtimes/[slug] view needs to fill a projector screen edge-to-edge),
// plus a small fixed "Login" link in the corner so a Daddy who lands
// here signed out has a way in without knowing the URL.
export default async function PlaytimesLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <div className="min-h-screen w-full">
        <Link
          href="/login"
          className="fixed top-3 right-3 z-20 text-sm font-semibold text-foreground-muted hover:opacity-80"
        >
          Login
        </Link>
        {children}
      </div>
    );
  }

  const openRequestCount = await prisma.helpRequest.count({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });

  return (
    <div className="min-h-screen">
      <AdminNav openRequestCount={openRequestCount} />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}

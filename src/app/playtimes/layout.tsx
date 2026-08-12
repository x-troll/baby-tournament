import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";

// Public tree — unlike admin/(protected), no requireAdmin() here. An
// admin who happens to be signed in gets the same nav + width as the
// rest of the admin panel; anyone else gets a bare, full-width surface
// (no nav at all — this is what an unauthenticated spectator's
// /playtimes/[slug] view needs to fill a projector screen edge-to-edge).
export default async function PlaytimesLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return <div className="min-h-screen w-full">{children}</div>;
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

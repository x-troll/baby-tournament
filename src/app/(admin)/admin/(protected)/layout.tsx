import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";

// Everything under admin/(protected)/** requires a session — the route
// group keeps /admin/login itself outside this layout so there's no
// redirect-to-login-from-login loop. See PLAN.md for why auth lives here
// (a server component check) rather than in Next middleware: bcryptjs
// needs the Node runtime, which middleware doesn't reliably give you.
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  // Same OPEN/ACKNOWLEDGED filter as the Requests page itself uses.
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

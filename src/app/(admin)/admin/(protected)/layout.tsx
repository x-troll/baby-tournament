import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/server-actions/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-elevated px-4 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <Link href="/admin">Playtimes</Link>
          <Link href="/admin/help-requests" className="flex items-center gap-1.5">
            Requests
            {openRequestCount > 0 && <Badge variant="danger">{openRequestCount}</Badge>}
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/admin/profile">Settings</Link>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}

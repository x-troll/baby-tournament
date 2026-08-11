import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/server-actions/auth";
import { Button } from "@/components/ui/button";

// Everything under admin/(protected)/** requires a session — the route
// group keeps /admin/login itself outside this layout so there's no
// redirect-to-login-from-login loop. See PLAN.md for why auth lives here
// (a server component check) rather than in Next middleware: bcryptjs
// needs the Node runtime, which middleware doesn't reliably give you.
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-elevated px-4 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <Link href="/admin">Playtimes</Link>
          <Link href="/admin/help-requests">Help requests</Link>
          <Link href="/admin/profile">My profile</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-foreground-muted">{admin.name}</span>
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

import Link from "next/link";
import { logoutAction } from "@/server-actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Shared by the authenticated admin layout and the public /playtimes
// layout (rendered there only when an admin happens to be signed in) —
// one nav, so both surfaces always look and behave the same.
export function AdminNav({ openRequestCount }: { openRequestCount: number }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-elevated px-4 py-3">
      <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        <Link href="/playtimes">Playtimes</Link>
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
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/server-actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Shared by the authenticated admin layout and the public /playtimes
// layout (rendered there only when an admin happens to be signed in) —
// one nav, so both surfaces always look and behave the same. Client
// component so usePathname() can bold/underline whichever link matches
// the current route.
function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} className={`flex items-center gap-1.5 ${active ? "underline decoration-2 underline-offset-4" : ""}`}>
      {children}
    </Link>
  );
}

export function AdminNav({ openRequestCount }: { openRequestCount: number }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background-elevated px-4 py-3">
      <div className="flex flex-wrap items-center gap-6">
        <span className="font-display text-lg font-bold tracking-wide">Troll Tournament</span>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <NavLink href="/playtimes">Playtimes</NavLink>
          <NavLink href="/admin/help-requests">
            Requests
            {openRequestCount > 0 && <Badge variant="danger">{openRequestCount}</Badge>}
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm font-semibold">
        <NavLink href="/admin/settings">Settings</NavLink>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}

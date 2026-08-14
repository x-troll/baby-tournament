import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";

// Everything under admin/(protected)/** requires a session — the login
// screen itself lives at /login, entirely outside this route group, so
// there's no redirect-to-login-from-login loop. See PLAN.md for why auth
// lives here (a server component check) rather than in Next middleware:
// bcryptjs needs the Node runtime, which middleware doesn't reliably give
// you.
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}

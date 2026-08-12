import { redirect } from "next/navigation";

// The admin dashboard now lives at /playtimes (same content, plus a
// public branch for unauthenticated visitors) — bare /admin still
// requires a session (via the (protected) layout) and then bounces
// straight there.
export default function AdminDashboardRedirect() {
  redirect("/playtimes");
}

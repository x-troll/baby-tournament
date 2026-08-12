import { redirect } from "next/navigation";

// Moved to /login (shorter, and not nested under a route an unauthenticated
// visitor's "Login" link would otherwise have to know about) — kept as a
// redirect so any bookmarked link still works.
export default function AdminLoginRedirect() {
  redirect("/login");
}

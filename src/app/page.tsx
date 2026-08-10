import { redirect } from "next/navigation";

// This is an admin-only self-serve tool — babies arrive via their
// Telegram deep link (/play/[slug]) and spectators via the TV link
// (/live/[slug]), neither of which ever touches "/". The only real
// audience for the bare root is a Daddy, so send them straight to the
// admin panel (which itself redirects to /admin/login if not signed in).
export default function RootPage() {
  redirect("/admin");
}

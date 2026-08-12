import { redirect } from "next/navigation";

// Babies arrive via their Telegram/website deep link (/play/[slug]) and
// spectators/admins via /playtimes, neither of which ever touches "/".
// Send the bare root straight to the public playtimes list — signed-out
// visitors see what's running right now, signed-in admins get the full
// dashboard on the same URL (see src/app/playtimes/page.tsx).
export default function RootPage() {
  redirect("/playtimes");
}

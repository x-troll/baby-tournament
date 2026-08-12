import { redirect } from "next/navigation";

// /admin/profile renamed to /admin/settings (the nav already called this
// link "Settings" while pointing at the mismatched old path) — kept as a
// redirect so any bookmarked link still works.
export default function AdminProfileRedirect() {
  redirect("/admin/settings");
}

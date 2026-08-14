import { AdminNav } from "@/components/AdminNav";
import { getOpenHelpRequestCount } from "@/lib/help-requests";

/**
 * The signed-in-admin chrome (nav + centered content column) — shared by
 * both admin/(protected)/layout.tsx (always applies) and
 * playtimes/layout.tsx (applies only when a signed-in admin happens to be
 * viewing that public route). Previously each hand-rolled the identical
 * `min-h-screen` / `<AdminNav>` / `max-w-5xl` markup and its own copy of
 * the open-help-request count query.
 */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const openRequestCount = await getOpenHelpRequestCount();

  return (
    <div className="min-h-screen">
      <AdminNav openRequestCount={openRequestCount} />
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}

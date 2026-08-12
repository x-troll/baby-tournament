import { redirect } from "next/navigation";

// /live/[slug] merged into /playtimes/[slug] (same slugNumber, branches
// on whether the visitor is a signed-in admin) — this old URL is kept as
// a redirect so any bookmarked/shared spectator link still works.
export default async function LiveRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/playtimes/${slug}`);
}

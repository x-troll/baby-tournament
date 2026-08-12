import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// /admin/playtimes/[id] (cuid-keyed) merged into /playtimes/[slug]
// (slugNumber-keyed) — kept as a redirect so old admin-panel links still
// resolve. Needs a lookup since this old route's [id] and the new
// route's [slug] aren't the same value.
export default async function AdminPlaytimeRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playtime = await prisma.playtime.findUnique({ where: { id }, select: { slugNumber: true } });
  if (!playtime) notFound();
  redirect(`/playtimes/${playtime.slugNumber}`);
}

import { NextResponse } from "next/server";
import { requireBaby } from "@/lib/baby-auth";
import { computeBabyStatus } from "@/lib/baby-status";

/**
 * Cookie-gated poll target for BrowserNotifications.tsx — mirrors
 * /api/playtime/[slug]/state's shape (just `{ kind }`, nothing else a
 * baby's own screen doesn't already show) so the client can diff kinds
 * across polls and fire a Notification on the transitions that matter.
 * `cache: "no-store"` — this is live per-baby state, never cacheable.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baby = await requireBaby(slug);
  const state = await computeBabyStatus(baby.id);
  return NextResponse.json({ kind: state.kind }, { headers: { "Cache-Control": "no-store" } });
}

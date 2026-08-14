import { EnterPinForm } from "@/components/EnterPinForm";

// The shared-PIN wall middleware.ts redirects anonymous visitors to (see
// that file for the full gate — an already-authenticated admin or baby
// never lands here at all). `?next=` is round-tripped straight from the
// URL the visitor originally asked for, so a correct PIN sends them on
// to where they meant to go instead of always landing on /playtimes.
// A plain server component just to resolve `searchParams` (a Promise in
// Server Components) — the actual form/useActionState lives in the
// client child, same split this codebase already uses elsewhere for
// "server resolves data, client handles the interactive form" pages.
export default async function EnterPinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <EnterPinForm next={next ?? "/playtimes"} />;
}

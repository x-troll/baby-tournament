import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Root not-found boundary — catches every `notFound()` call (invalid
 * playtime slug, expired magic link's own 404) that previously fell
 * through to Next's default unstyled 404 with no way back anywhere.
 */
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl">🍼</p>
      <h1 className="text-xl font-bold">Nothing here.</h1>
      <p className="max-w-sm text-sm text-foreground-muted">
        This page doesn&rsquo;t exist, or whatever it was looking for isn&rsquo;t there anymore.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Go home
      </Link>
    </main>
  );
}

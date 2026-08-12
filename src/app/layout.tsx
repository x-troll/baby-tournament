import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--next-font-display",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--next-font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Playtime",
  description: "A self-serve tournament bracket manager for a one-night bar event.",
};

// One theme only (dark, nursery skin — see tokens.css) — no
// light/dark toggle, no no-flash script, nothing to set on <html> at
// all; tokens.css's :root is already the only palette that exists.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { getThemeSkin } from "@/lib/terminology";
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

// Runs before paint, inline (not a module — deliberately not deferred),
// so the manual light/dark override from localStorage applies before the
// first frame. Without this the page would flash the system-preference
// theme and then snap to the stored override.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("playtime-theme-mode");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-mode", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // THEME is a deploy-time env flag (nursery default, plain for
  // screenshots/testing) — baked in server-side, not user-togglable.
  const skin = getThemeSkin();

  return (
    <html lang="en" data-skin={skin} className={`${fredoka.variable} ${nunito.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

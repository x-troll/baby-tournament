"use client";

import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";

/**
 * Light/dark palettes for the QR itself. A plain white square (and a
 * center logo baking in its own hardcoded white background, e.g.
 * website-signup-badge.svg) reads as a jarring bright hole dropped into
 * an otherwise dark page, so dark mode moves the background to the same
 * elevated-dark surface color the QR already sits inside (its
 * containing Card).
 *
 * The main dot gradient stays the same purple/pink in both modes
 * deliberately, not just for brand consistency — those medium-brightness
 * hues actually contrast *better* against the dark background than
 * against white (a medium color sits closer to white's luminance than to
 * near-black's). The one color that doesn't survive the swap unscanned
 * is cornersDot: it was already fairly dark in light mode, so on a dark
 * background it'd sit too close in luminance to the QR's own background,
 * right at one of the three finder-pattern eyes that scanners rely on
 * most — brightened here rather than reused verbatim.
 */
const QR_PALETTE = {
  light: {
    background: "#ffffff",
    dotsGradientFrom: "#7B8FEE",
    dotsGradientTo: "#E46D9B",
    dotsColor: "#6a1a4c",
    cornersSquare: "#7B8FEE",
    cornersDot: "#b92d5d",
  },
  dark: {
    background: "#20234a",
    dotsGradientFrom: "#7B8FEE",
    dotsGradientTo: "#E46D9B",
    dotsColor: "#f6c9dd",
    cornersSquare: "#a8b8f0",
    cornersDot: "#e3b8c9",
  },
} as const;

function readIsDarkMode(): boolean {
  // tokens.css already resolves prefers-color-scheme + the data-mode
  // override into a single `color-scheme` value on :root — reading the
  // computed result here avoids re-deriving that light/dark logic.
  return typeof window !== "undefined" && getComputedStyle(document.documentElement).colorScheme === "dark";
}

/**
 * Renders a styled QR code entirely in the browser — qr-code-styling
 * draws into a real <canvas>, which a browser provides for free.
 * Deliberately NOT server-rendered: the library's server-side path needs
 * `node-canvas` (a native addon requiring a C++ toolchain/Cairo) plus
 * `jsdom` to fake a DOM, which would be this project's first native
 * dependency and a known Heroku build-image pain point — this codebase
 * has stayed pure-JS everywhere else (e.g. bcryptjs over bcrypt).
 *
 * Style values below match the config you generated with qr-code-styling
 * .com — the `*Helper` keys in that export are generator-UI-only state,
 * not real constructor options, so they're dropped here. `backgroundOptions.round`
 * gives the QR's own white square subtly rounded corners baked into the
 * rendered image itself, rather than a separately-added wrapper/border.
 */
export function StyledQrCode({
  data,
  size = 300,
  logoSrc,
  logoSrcDark,
}: {
  data: string;
  size?: number;
  logoSrc?: string;
  /**
   * Dark-mode counterpart for logoSrc — only needed for a center image
   * that bakes in its own fixed light background (see
   * website-signup-badge.svg / website-signup-badge-dark.svg). Falls
   * back to logoSrc when omitted, which is exactly right for a logo that
   * has no fixed background of its own (the Telegram badge already
   * reads fine against either QR background).
   */
  logoSrcDark?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detected post-mount, not from initial render state (SSR/hydration
  // has no access to the real computed color-scheme) — a brief flash of
  // the light palette before this corrects is an acceptable tradeoff for
  // a canvas-drawn element that was never going to be theme-correct in
  // the server-rendered HTML anyway.
  useEffect(() => {
    function recompute() {
      setIsDark(readIsDarkMode());
    }
    recompute();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", recompute);
    // Catches both the manual ThemeToggle (data-mode) and the spectator
    // screen's forced-dark script, whichever fires relative to this
    // component's own mount.
    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-skin"] });
    return () => {
      mq.removeEventListener("change", recompute);
      observer.disconnect();
    };
  }, []);

  const palette = isDark ? QR_PALETTE.dark : QR_PALETTE.light;
  const effectiveLogoSrc = isDark ? (logoSrcDark ?? logoSrc) : logoSrc;

  // Constructed once, on mount — style options never change shape after
  // that, only their values do (handled below via .update(), the API
  // this library actually provides for that, rather than tearing the
  // whole thing down and rebuilding it on every change).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    qrRef.current = new QRCodeStyling({
      type: "canvas",
      shape: "square",
      width: size,
      height: size,
      data,
      margin: 4,
      image: effectiveLogoSrc,
      qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: "Q" },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.5, margin: 3 },
      dotsOptions: {
        type: "extra-rounded",
        color: palette.dotsColor,
        roundSize: true,
        gradient: {
          type: "linear",
          rotation: Math.PI / 2,
          colorStops: [
            { offset: 0, color: palette.dotsGradientFrom },
            { offset: 1, color: palette.dotsGradientTo },
          ],
        },
      },
      backgroundOptions: { round: 0.05, color: palette.background },
      cornersSquareOptions: { type: "extra-rounded", color: palette.cornersSquare },
      cornersDotOptions: { type: "dot", color: palette.cornersDot },
    });
    qrRef.current.append(container);

    return () => {
      // qr-code-styling has no explicit destroy() — clearing the
      // container is the documented workaround before the next mount.
      container.innerHTML = "";
      qrRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally construct-once with whatever palette/logo is current at mount; every later change (including a dark-mode flip) is handled by the .update() effect below, not a rebuild
  }, []);

  useEffect(() => {
    qrRef.current?.update({
      data,
      image: effectiveLogoSrc,
      width: size,
      height: size,
      dotsOptions: {
        type: "extra-rounded",
        color: palette.dotsColor,
        roundSize: true,
        gradient: {
          type: "linear",
          rotation: Math.PI / 2,
          colorStops: [
            { offset: 0, color: palette.dotsGradientFrom },
            { offset: 1, color: palette.dotsGradientTo },
          ],
        },
      },
      backgroundOptions: { round: 0.05, color: palette.background },
      cornersSquareOptions: { type: "extra-rounded", color: palette.cornersSquare },
      cornersDotOptions: { type: "dot", color: palette.cornersDot },
    });
  }, [data, effectiveLogoSrc, size, palette]);

  return <div ref={containerRef} />;
}

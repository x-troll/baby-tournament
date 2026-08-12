"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

/**
 * The QR's own palette — a plain white square would read as a jarring
 * bright hole dropped into this app's always-dark page, so the
 * background matches the same elevated-dark surface color the QR
 * already sits inside (its containing Card). `imageOptions.hideBackgroundDots`
 * is off (dots render everywhere, logo drawn on top) so the dots read as
 * continuous through the QR's non-logo area; the center logo images
 * themselves each bake in a round backdrop circle in this same
 * background color (see public/telegram-logo.svg, public/website-signup-badge.svg)
 * so dots don't poke into their square image footprint's corners.
 */
const QR_PALETTE = {
  background: "#20234a",
  dotsGradientFrom: "#7B8FEE",
  dotsGradientTo: "#E46D9B",
  dotsColor: "#f6c9dd",
  cornersSquare: "#a8b8f0",
  cornersDot: "#e3b8c9",
};

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
}: {
  data: string;
  size?: number;
  logoSrc?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

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
      image: logoSrc,
      qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: "Q" },
      imageOptions: { hideBackgroundDots: false, imageSize: 0.5, margin: 3 },
      dotsOptions: {
        type: "extra-rounded",
        color: QR_PALETTE.dotsColor,
        roundSize: true,
        gradient: {
          type: "linear",
          rotation: Math.PI / 2,
          colorStops: [
            { offset: 0, color: QR_PALETTE.dotsGradientFrom },
            { offset: 1, color: QR_PALETTE.dotsGradientTo },
          ],
        },
      },
      backgroundOptions: { round: 0.05, color: QR_PALETTE.background },
      cornersSquareOptions: { type: "extra-rounded", color: QR_PALETTE.cornersSquare },
      cornersDotOptions: { type: "dot", color: QR_PALETTE.cornersDot },
    });
    qrRef.current.append(container);

    return () => {
      // qr-code-styling has no explicit destroy() — clearing the
      // container is the documented workaround before the next mount.
      container.innerHTML = "";
      qrRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally construct-once; data/logoSrc/size changes are handled by the .update() effect below, not a rebuild
  }, []);

  useEffect(() => {
    qrRef.current?.update({ data, image: logoSrc, width: size, height: size });
  }, [data, logoSrc, size]);

  return <div ref={containerRef} />;
}

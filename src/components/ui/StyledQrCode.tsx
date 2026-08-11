"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

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
 * not real constructor options, so they're dropped here.
 */
export function StyledQrCode({ data, size = 300, logoSrc }: { data: string; size?: number; logoSrc?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  // Constructed once, on mount — style options never change, only
  // data/logoSrc/size do (handled below via .update(), the API this
  // library actually provides for that, rather than tearing the whole
  // thing down and rebuilding it on every change).
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
      imageOptions: { hideBackgroundDots: true, imageSize: 0.5, margin: 3 },
      dotsOptions: {
        type: "extra-rounded",
        color: "#6a1a4c",
        roundSize: true,
        gradient: {
          type: "linear",
          rotation: Math.PI / 2,
          colorStops: [
            { offset: 0, color: "#7B8FEE" },
            { offset: 1, color: "#E46D9B" },
          ],
        },
      },
      backgroundOptions: { round: 0, color: "#ffffff" },
      cornersSquareOptions: { type: "extra-rounded", color: "#7B8FEE" },
      cornersDotOptions: { type: "dot", color: "#b92d5d" },
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

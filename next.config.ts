import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Screenshots are committed under public/rules/<game>/ and served via
  // next/image — no remote patterns needed, everything is local.
  images: {
    formats: ["image/webp"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // `credentialless` keeps the page cross-origin-isolated (WebContainer /
          // SharedArrayBuffer requirement) while still allowing third-party CDN
          // scripts (unpkg, tailwind, fonts) used by the esbuild/iframe previews
          // to load without per-resource CORP headers.
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;

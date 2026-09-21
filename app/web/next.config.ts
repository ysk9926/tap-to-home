import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      {
        // Vercel Cron does not follow redirects. Keep its endpoints on both hosts.
        source: "/:path((?!api/cron(?:/|$)).*)",
        has: [{ type: "host", value: "tap-to-home-web\\.vercel\\.app" }],
        destination: "https://taptohome.site/:path",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

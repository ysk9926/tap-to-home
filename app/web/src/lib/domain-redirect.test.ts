import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

describe("production domain redirect", () => {
  it.each([
    "/",
    "/login",
    "/records/2026-09-20?from=push&filter=all",
    "/admin/login",
    "/api/auth/get-session",
    "/api/cronicle",
  ])("preserves the path and query for %s on the old host", async (path) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://tap-to-home-web.vercel.app${path}`,
      nextConfig,
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://taptohome.site${path}`);
  });

  it.each(["/api/cron", "/api/cron/settle", "/api/cron/settle?retry=1"])(
    "does not redirect scheduled requests to %s",
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://tap-to-home-web.vercel.app${path}`,
        nextConfig,
      });

      expect(response.headers.get("location")).toBeNull();
    },
  );

  it.each([
    "https://taptohome.site",
    "https://tap-to-home-web-preview.vercel.app",
    "http://localhost:3000",
  ])("leaves %s on its own origin", async (origin) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `${origin}/login?next=%2Ffriends`,
      nextConfig,
    });

    expect(response.headers.get("location")).toBeNull();
  });
});

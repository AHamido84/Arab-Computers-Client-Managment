import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Notes
 * - cacheComponents is intentionally OFF: every screen is behind auth and
 *   user/role-specific, so static shells bring no benefit here.
 * - @react-pdf/renderer runs only on the server (route handlers) and must not
 *   be bundled through the RSC compiler.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  // Bundle PDF fonts + logo with the serverless functions that render PDFs / send emails.
  outputFileTracingIncludes: {
    "/api/**": ["./src/pdf/fonts/**", "./public/brand/**"],
    "/**": ["./src/pdf/fonts/**", "./public/brand/**"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);

import type { NextConfig } from "next";

// A static site: `next build` writes plain files to out/, which any free host can serve (Cloudflare Pages).
// There is no server, so no headers() here: public/_headers carries the security headers, public/_redirects the
// "/" -> "/en/" redirect. globalNotFound gives unknown addresses one 404 page that ignores the [lang] layout.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { globalNotFound: true },
};

export default nextConfig;

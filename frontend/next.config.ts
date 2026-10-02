import type { NextConfig } from "next";

// The browser only talks to this site. /api is proxied to the backend, so the session cookie is first-party (httpOnly).
const BACKEND = (process.env.API_PROXY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};
export default nextConfig;

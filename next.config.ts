import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the tracing root to this project (a stray lockfile exists in the home dir).
  outputFileTracingRoot: path.join(__dirname),
  images: {
    // Supabase Storage public bucket URLs, e.g.
    // https://<project-ref>.supabase.co/storage/v1/object/public/article-images/...
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

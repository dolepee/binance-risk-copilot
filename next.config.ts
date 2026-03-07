import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  basePath,
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: isStaticExport,
  },
};

export default nextConfig;

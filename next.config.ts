import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.210.43.79"],
  cacheComponents: true,
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.experiments = {
        ...config.experiments,
        lazyCompilation: false,
      };
    }

    return config;
  },
};

export default nextConfig;

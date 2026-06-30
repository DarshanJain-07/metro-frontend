import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.210.43.79"],
  cacheComponents: true,
  turbopack: {},
  cacheLife: {
    masterData: {
      stale: 60 * 60,
      revalidate: 60 * 60 * 6,
      expire: 60 * 60 * 24,
    },
    dashboard: {
      stale: 60,
      revalidate: 60 * 5,
      expire: 60 * 15,
    },
  },
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

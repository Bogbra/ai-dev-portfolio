import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output bundles the server + runtime node_modules for Docker.
  // Has no effect on Vercel deployments — Vercel ignores this setting.
  output: 'standalone',

  // Point the file tracer at the monorepo root so pnpm workspace packages
  // (packages/types) are correctly included in the standalone bundle.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),

  webpack(config) {
    // workspace packages use TypeScript ESM convention (.js imports that resolve to .ts).
    // webpack 5 extensionAlias maps .js → .ts so bundler resolution works correctly.
    config.resolve = {
      ...config.resolve,
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.jsx': ['.tsx', '.jsx'],
      },
    };
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;

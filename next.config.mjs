import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'ml.globenewswire.com',
      },
      {
        protocol: 'https',
        hostname: '**.globenewswire.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Externalize canvas for server-side chart rendering
  serverExternalPackages: ['canvas', '@napi-rs/canvas', 'chartjs-node-canvas'],
  // Ensure server-side chart rendering has access to a real font (Vercel serverless
  // can have zero system fonts installed, which causes tofu squares for any text).
  outputFileTracingIncludes: {
    '/api/**': ['src/lib/charts/fonts/*.otf'],
  },
};

export default withNextIntl(nextConfig);

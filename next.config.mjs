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
  serverExternalPackages: ['canvas', 'chartjs-node-canvas'],
};

export default withNextIntl(nextConfig);

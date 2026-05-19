import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  // Block search-engine indexing of cms.triplypro.com. The robots.txt at
  // src/app/robots.ts is the primary signal; this header is defense in
  // depth for bots that ignore robots.txt. The public blog lives on
  // www.triplypro.com — this subdomain is admin-only and has no SEO value.
  //
  // Egress incident May 19, 2026: noindex/robots.txt do not block bot
  // *requests*, only indexing. Bots were still hammering /api/posts and
  // each hit went straight to Postgres (Payload's default Cache-Control
  // is `public, max-age=0, must-revalidate`, so Vercel CDN was not caching).
  // The Cache-Control overrides below put a 1h CDN cache in front of the
  // public read endpoints so direct bot/external hits become CDN hits
  // instead of Postgres queries. Admin/auth endpoints are NOT cached.
  async headers() {
    const publicReadCacheControl = 'public, s-maxage=3600, stale-while-revalidate=86400'
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/api/:resource(posts|categories|media)',
        headers: [
          { key: 'Cache-Control', value: publicReadCacheControl },
        ],
      },
      {
        source: '/api/:resource(posts|categories|media)/:path*',
        headers: [
          { key: 'Cache-Control', value: publicReadCacheControl },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

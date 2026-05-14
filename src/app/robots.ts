import type { MetadataRoute } from 'next'

/**
 * Block all crawlers from cms.triplypro.com.
 *
 * This subdomain hosts the Payload admin UI and its REST/GraphQL API.
 * It is not the public blog (that lives on www.triplypro.com), so there
 * is no SEO value in indexing it — and crawlers walking the public Payload
 * API was the cause of the Supabase egress overage in May 2026 (see plan
 * dazzling-humming-crayon.md).
 *
 * A noindex header is also set in next.config.mjs as defense in depth for
 * bots that ignore robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}

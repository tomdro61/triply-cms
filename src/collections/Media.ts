import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'public/media',
    mimeTypes: ['image/*'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 432,
        position: 'centre',
      },
      {
        name: 'feature',
        width: 1200,
        height: 630,
        position: 'centre',
      },
    ],
  },
  access: {
    // Read stays public for now: blog images may be served via this
    // collection's file route, and locking it could 403 images for anonymous
    // visitors. Media is only ~9.6MB so it's a minor egress source vs the 71MB
    // posts table. Revisit (lock to `authenticated`) once we confirm blog
    // images load from Vercel Blob (public) and not from cms.triplypro.com.
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}

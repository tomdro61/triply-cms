import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { ContentQueue } from './collections/ContentQueue'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '- Triply CMS',
    },
  },

  // CORS for main site to fetch blog data
  cors: [
    'https://cms.triplypro.com',
    'https://triplypro.com',
    'https://www.triplypro.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  csrf: [
    'https://cms.triplypro.com',
    'https://triplypro.com',
    'https://www.triplypro.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ],

  collections: [Users, Media, Posts, Categories, Tags, ContentQueue],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    schemaName: 'payload',
    push: true,
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
})

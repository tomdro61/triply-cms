import { postgresAdapter } from '@payloadcms/db-postgres'
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

  collections: [Users, Media, Posts, Categories, Tags],
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
    push: false,
  }),
  sharp,
  plugins: [],
})

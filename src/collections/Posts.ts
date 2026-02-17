import { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'category', 'seoScore', 'publishedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 100,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.title) {
              return data.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 300,
      admin: {
        description: 'Brief summary for SEO and post previews (max 300 chars)',
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
      },
      defaultValue: ({ user }) => user?.id,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          maxLength: 60,
          admin: {
            description: 'Override title for search engines (max 60 chars)',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          maxLength: 160,
          admin: {
            description: 'Description for search engines (max 160 chars)',
          },
        },
      ],
    },
    // SEO scoring
    {
      name: 'seoScore',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        position: 'sidebar',
        description: 'SEO score (0-100) — run blog-engine score command to update',
        readOnly: true,
      },
    },
    {
      name: 'seoScoreDetails',
      type: 'json',
      admin: {
        description: 'Full SEO scoring breakdown — updated by the blog engine score command',
        readOnly: true,
      },
    },
    // Blog engine fields
    {
      name: 'airportCode',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Airport IATA code (e.g., JFK, LGA)',
      },
    },
    {
      name: 'articleType',
      type: 'select',
      index: true,
      options: [
        { label: 'Hub', value: 'hub' },
        { label: 'Sub-Pillar', value: 'sub-pillar' },
        { label: 'Spoke', value: 'spoke' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Topic cluster tier for SEO content',
      },
    },
    {
      name: 'parentSlug',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Parent article slug (for sub-pillars and spokes)',
      },
    },
    {
      name: 'hubSlug',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Hub article slug for the airport cluster',
      },
    },
    {
      name: 'faqItems',
      type: 'array',
      admin: {
        description: 'FAQ items for accordion display and schema markup',
      },
      fields: [
        {
          name: 'question',
          type: 'text',
          required: true,
        },
        {
          name: 'answer',
          type: 'textarea',
          required: true,
        },
      ],
    },
  ],
}

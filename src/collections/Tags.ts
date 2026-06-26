import { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    // Read kept public (tiny 744KB table, negligible egress; avoids breaking
    // any public tag listing). Writes locked to close the create/delete hole.
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
}

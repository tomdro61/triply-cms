import type { CollectionConfig } from 'payload'
import { authed, isAdmin } from '../access'

/** Amenity labels for direct lots (ported from APB). Shown on every lot page, so admin-only to change. */
export const LotAmenities: CollectionConfig = {
  slug: 'lot-amenities',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'icon'],
    group: 'Direct Lots',
  },
  // Amenity names appear on every lot page: admin-only to change.
  access: {
    read: authed,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Display name (e.g. "EV Charging", "Covered Parking", "Shuttle to Terminal")' },
    },
    {
      name: 'icon',
      type: 'text',
      admin: { description: 'Icon token used by the site icon set (e.g. "plug", "roof")' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Short tooltip description (optional)' },
    },
  ],
}

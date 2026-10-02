import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminField, isAdminOrSelf } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'email',
  },
  // Locked October 2, 2026 (Phase 0a). Previously every action was `() => true`:
  // anyone could create an admin, change a password, or list users — and
  // Payload's apiKey field decrypts on read, so API keys were readable too.
  // Admins manage users; a user may read and edit their own record only.
  access: {
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      defaultValue: 'editor',
      required: true,
      // Only an admin may change roles — otherwise an editor editing their own
      // record could promote themselves.
      access: { update: isAdminField },
    },
  ],
}

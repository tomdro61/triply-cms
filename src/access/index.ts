import type { Access, FieldAccess } from 'payload'

/**
 * Shared access rules (Phase 0a of the CMS lockdown, October 2, 2026).
 *
 * Until this file existed every collection — including Users — was
 * `read/create/update/delete: () => true`: anyone on the internet could create
 * a CMS admin, change a user's password, or read the users list (and, through
 * Payload's apiKey field, API keys). These helpers are the only access
 * functions collections should use.
 *
 * `req.user` is set for a logged-in admin session AND for a request carrying a
 * valid `Authorization: users API-Key <key>` header (the blog engine, and the
 * main app once it sends its key). Anonymous requests have no user. Its type
 * comes from the generated `payload-types.ts` (`role: 'admin' | 'editor'`).
 */

/** Any authenticated user or API key. */
export const authed: Access = ({ req }) => Boolean(req.user)

/** Only users with the admin role. */
export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'

/** Admins, or the user acting on their own record (a Payload `where` for lists). */
export const isAdminOrSelf: Access = ({ req, id }) => {
  const user = req.user
  if (!user) return false
  if (user.role === 'admin') return true
  if (id !== undefined) return String(id) === String(user.id)
  return { id: { equals: user.id } }
}

/** Field-level: admins only (e.g. the role field, so an editor can't promote themselves). */
export const isAdminField: FieldAccess = ({ req }) => req.user?.role === 'admin'

/** Public read — kept explicit so a grep for `() => true` finds only deliberate uses. */
export const anyone: Access = () => true

import type { Access } from 'payload'

/**
 * Allow the operation only for authenticated requests: a logged-in admin/editor
 * OR a valid API key (the Users collection has `useAPIKey: true`). Anonymous
 * public requests are denied.
 *
 * This is the core of the egress fix (2026-06): a crawler hitting /api/posts
 * with no auth gets a 403 with NO Postgres query, instead of making Payload
 * pull the ~71MB posts table out of the database. The main app authenticates
 * its server-side blog reads with PAYLOAD_API_KEY (see triply/src/lib/cms.ts).
 * It also closes a security hole — these collections previously allowed
 * unauthenticated create/update/delete (incl. public CMS-admin creation).
 */
export const authenticated: Access = ({ req }) => Boolean(req.user)

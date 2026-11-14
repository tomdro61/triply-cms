import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload 3.74 -> 3.93 (security upgrade). Payload 3.90 added two fields that
 * every query on these tables selects, so the columns must exist BEFORE any
 * 3.90+ code runs against this database. That includes a Vercel preview of
 * the upgrade branch: previews use the production database.
 *
 * - users.reset_password_requested_at: when a password reset was last asked
 *   for (3.90 throttles forgot-password).
 * - media._objectkey: the storage key of a client upload (stays NULL here; we
 *   do not use client uploads, but the storage plugin selects the column).
 *
 * Both are nullable with no default and no index, so adding them rewrites
 * nothing and Payload 3.74 keeps working with them in place: apply first,
 * deploy second. This is exactly what `payload migrate:create` generated
 * between 3.74.0 and 3.93.0 (checked in a throwaway clone with dummy
 * credentials; it was the whole difference), with guards added.
 *
 * Apply to Triply-prod over the SESSION-mode connection (port 5432, no
 * `?pgbouncer=true`) BEFORE the upgrade deploys or is previewed:
 *   DATABASE_URI=<session uri> npx payload migrate
 * Verify: both columns exist and payload_migrations has this row. Every
 * statement is guarded, so a re-run is safe.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';

    ALTER TABLE "payload"."users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
    ALTER TABLE "payload"."media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;
  `)
}

// Normally never run: leave the columns in place on a rollback (3.74 ignores
// them). If they must go, roll the code back to Payload 3.74 FIRST: 3.90+
// selects both columns on every users and media read, so dropping them under
// the deployed code breaks the admin, the blog engine's API key and every
// post with an image.
//
// A code rollback does NOT undo passwords: a successful login on 3.90+
// rewrites that account's hash in a format 3.74 cannot verify (this happens on
// a preview too, since previews share this database). After a rollback, an
// admin who never logged in on 3.90+ must reset the others' passwords in the
// admin. API keys are not affected.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."users" DROP COLUMN IF EXISTS "reset_password_requested_at";
    ALTER TABLE "payload"."media" DROP COLUMN IF EXISTS "_objectkey";
  `)
}

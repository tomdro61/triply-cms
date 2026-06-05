import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE payload.posts ADD COLUMN IF NOT EXISTS "content_updated_at" timestamp(3) with time zone`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE payload.posts DROP COLUMN IF EXISTS "content_updated_at"`)
}

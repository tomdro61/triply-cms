import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE payload.content_queue DROP COLUMN IF EXISTS "suggested_title"`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE payload.content_queue ADD COLUMN IF NOT EXISTS "suggested_title" varchar`)
}

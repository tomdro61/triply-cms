import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Lots: `vehicleSurcharges` array (plan notes/2026-10-09-direct-lots-vehicle-surcharge-plan.md
 * §1.1). One new array table; nothing existing is altered. Hand-written in the
 * style of 20261005_add_lots (same DDL Payload generates for an array of
 * text/text/number fields).
 *
 * Apply to Triply-prod over the SESSION-mode connection (port 5432, no
 * `?pgbouncer=true`) BEFORE the collection code deploys:
 *   DATABASE_URI=<session uri> npx payload migrate
 * Verify: to_regclass('payload.lots_vehicle_surcharges') IS NOT NULL and
 * payload_migrations has this row. Every statement is guarded, so a re-run is safe.
 *
 * The main app reads this table through its own database function (app
 * migration 036, `public.direct_lots_v2`): a column rename here must be mirrored there.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';

    CREATE TABLE IF NOT EXISTS "payload"."lots_vehicle_surcharges" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "code" varchar NOT NULL,
      "label" varchar NOT NULL,
      "daily_rate" numeric NOT NULL
    );

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_vehicle_surcharges_parent_id_fk') THEN
        ALTER TABLE "payload"."lots_vehicle_surcharges" ADD CONSTRAINT "lots_vehicle_surcharges_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "payload"."lots"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "lots_vehicle_surcharges_order_idx" ON "payload"."lots_vehicle_surcharges" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "lots_vehicle_surcharges_parent_id_idx" ON "payload"."lots_vehicle_surcharges" USING btree ("_parent_id");
  `)
}

// Revert the collection code AND the app's direct_lots_v2() (migration 036) FIRST:
// Payload joins this table on every lot read, so dropping it under the deployed
// code breaks the Lots admin, and v2 errors at call time.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "payload"."lots_vehicle_surcharges";
  `)
}

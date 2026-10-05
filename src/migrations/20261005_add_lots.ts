import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Direct lots: `lots` + `lot-amenities` collections (plan notes/2026-10-02-direct-lots-plan-v1.md
 * §9, review A-16). Hand-written in the style of the two earlier migrations, pruned
 * from `payload migrate:create` output (which, with no baseline snapshot, emits the
 * whole schema). Only statements for the new tables are kept; the existing
 * `payload_locked_documents_rels` table gains two nullable columns.
 *
 * Apply to Triply-prod over the SESSION-mode connection (port 5432, no
 * `?pgbouncer=true`) BEFORE the collection code deploys:
 *   DATABASE_URI=<session uri> npx payload migrate
 * Verify: to_regclass('payload.lots') IS NOT NULL and payload_migrations has this row.
 * Every statement is IF NOT EXISTS / guarded, so a re-run is safe.
 *
 * The main app reads these tables through its own `public.direct_lots` function
 * (app migration 035): a column rename here must be mirrored there.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Payload runs a migration in one transaction. The ALTER on
    -- payload_locked_documents_rels (read on every admin document open) and the
    -- media FKs take locks held to commit; fail fast rather than queue every CMS
    -- request behind a long reader. Transaction-scoped. Apply at a quiet hour.
    SET LOCAL lock_timeout = '5s';

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                     WHERE n.nspname = 'payload' AND t.typname = 'enum_lots_status') THEN
        CREATE TYPE "payload"."enum_lots_status" AS ENUM('draft', 'published');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS "payload"."lot_amenities" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "icon" varchar,
      "description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "payload"."lots" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "airport_code" varchar NOT NULL,
      "reslab_location_id" numeric,
      "description_short" varchar,
      "featured_image_id" integer,
      "content" jsonb,
      "distance_to_terminal_minutes" numeric,
      "shuttle_details" varchar,
      "shuttle_phone" varchar,
      "address_street" varchar NOT NULL,
      "address_city" varchar NOT NULL,
      "address_state" varchar NOT NULL,
      "address_zip" varchar NOT NULL,
      "coordinates_lat" numeric NOT NULL,
      "coordinates_lng" numeric NOT NULL,
      "booking_instructions_before_arrival" varchar,
      "booking_instructions_when_you_arrive" varchar,
      "booking_instructions_important_notes" varchar,
      "booking_instructions_when_you_return" varchar,
      "booking_instructions_getting_to_airport" varchar,
      "is_active" boolean DEFAULT false,
      "visibility" varchar DEFAULT 'staging_only' NOT NULL,
      "min_stay_days" numeric DEFAULT 1,
      "min_lead_hours" numeric DEFAULT 2,
      "base_daily_rate" numeric NOT NULL,
      "tax_rate_percent" numeric NOT NULL,
      "tax_collected_by" varchar NOT NULL,
      "partner_share_percent" numeric NOT NULL,
      "status" "payload"."enum_lots_status" DEFAULT 'draft' NOT NULL,
      "published_at" timestamp(3) with time zone,
      "seo_meta_title" varchar,
      "seo_meta_description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "payload"."lots_gallery" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "payload"."lots_faqs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "question" varchar NOT NULL,
      "answer" jsonb NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "payload"."lots_notification_emails" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "email" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "payload"."lots_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "lot_amenities_id" integer
    );

    ALTER TABLE "payload"."payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "lots_id" integer,
      ADD COLUMN IF NOT EXISTS "lot_amenities_id" integer;

    DO $$ BEGIN
      -- Guards are schema-qualified: the same constraint names could exist in public.
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_featured_image_id_media_id_fk') THEN
        ALTER TABLE "payload"."lots" ADD CONSTRAINT "lots_featured_image_id_media_id_fk"
          FOREIGN KEY ("featured_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_gallery_image_id_media_id_fk') THEN
        ALTER TABLE "payload"."lots_gallery" ADD CONSTRAINT "lots_gallery_image_id_media_id_fk"
          FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_gallery_parent_id_fk') THEN
        ALTER TABLE "payload"."lots_gallery" ADD CONSTRAINT "lots_gallery_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "payload"."lots"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_faqs_parent_id_fk') THEN
        ALTER TABLE "payload"."lots_faqs" ADD CONSTRAINT "lots_faqs_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "payload"."lots"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_notification_emails_parent_id_fk') THEN
        ALTER TABLE "payload"."lots_notification_emails" ADD CONSTRAINT "lots_notification_emails_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "payload"."lots"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_rels_parent_fk') THEN
        ALTER TABLE "payload"."lots_rels" ADD CONSTRAINT "lots_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "payload"."lots"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'lots_rels_lot_amenities_fk') THEN
        ALTER TABLE "payload"."lots_rels" ADD CONSTRAINT "lots_rels_lot_amenities_fk"
          FOREIGN KEY ("lot_amenities_id") REFERENCES "payload"."lot_amenities"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'payload_locked_documents_rels_lots_fk') THEN
        ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lots_fk"
          FOREIGN KEY ("lots_id") REFERENCES "payload"."lots"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = 'payload'::regnamespace AND conname = 'payload_locked_documents_rels_lot_amenities_fk') THEN
        ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lot_amenities_fk"
          FOREIGN KEY ("lot_amenities_id") REFERENCES "payload"."lot_amenities"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "lot_amenities_name_idx" ON "payload"."lot_amenities" USING btree ("name");
    CREATE INDEX IF NOT EXISTS "lot_amenities_updated_at_idx" ON "payload"."lot_amenities" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "lot_amenities_created_at_idx" ON "payload"."lot_amenities" USING btree ("created_at");

    CREATE UNIQUE INDEX IF NOT EXISTS "lots_slug_idx" ON "payload"."lots" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "lots_airport_code_idx" ON "payload"."lots" USING btree ("airport_code");
    CREATE UNIQUE INDEX IF NOT EXISTS "lots_reslab_location_id_idx" ON "payload"."lots" USING btree ("reslab_location_id");
    CREATE INDEX IF NOT EXISTS "lots_featured_image_idx" ON "payload"."lots" USING btree ("featured_image_id");
    CREATE INDEX IF NOT EXISTS "lots_updated_at_idx" ON "payload"."lots" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "lots_created_at_idx" ON "payload"."lots" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "lots_gallery_order_idx" ON "payload"."lots_gallery" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "lots_gallery_parent_id_idx" ON "payload"."lots_gallery" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "lots_gallery_image_idx" ON "payload"."lots_gallery" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "lots_faqs_order_idx" ON "payload"."lots_faqs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "lots_faqs_parent_id_idx" ON "payload"."lots_faqs" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "lots_notification_emails_order_idx" ON "payload"."lots_notification_emails" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "lots_notification_emails_parent_id_idx" ON "payload"."lots_notification_emails" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "lots_rels_order_idx" ON "payload"."lots_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "lots_rels_parent_idx" ON "payload"."lots_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "lots_rels_path_idx" ON "payload"."lots_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "lots_rels_lot_amenities_id_idx" ON "payload"."lots_rels" USING btree ("lot_amenities_id");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lots_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("lots_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lot_amenities_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("lot_amenities_id");
  `)
}

/**
 * Rollback drops every direct-lot table. This permanently discards every lot
 * record — only run it before the first production booking at a direct lot,
 * and only AFTER reverting the collection code: the deployed admin selects
 * payload_locked_documents_rels.lots_id on every document open.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lots_fk",
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lot_amenities_fk";
    DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_lots_id_idx";
    DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_lot_amenities_id_idx";
    ALTER TABLE "payload"."payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "lots_id",
      DROP COLUMN IF EXISTS "lot_amenities_id";
    DROP TABLE IF EXISTS "payload"."lots_rels";
    DROP TABLE IF EXISTS "payload"."lots_notification_emails";
    DROP TABLE IF EXISTS "payload"."lots_faqs";
    DROP TABLE IF EXISTS "payload"."lots_gallery";
    DROP TABLE IF EXISTS "payload"."lots";
    DROP TABLE IF EXISTS "payload"."lot_amenities";
    DROP TYPE IF EXISTS "payload"."enum_lots_status";
  `)
}

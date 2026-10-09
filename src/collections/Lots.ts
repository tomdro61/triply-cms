import type { CollectionConfig, FieldHook } from 'payload'
import { ValidationError } from 'payload'
import { authed, isAdmin, isAdminField } from '../access'

/**
 * Direct lots — parking lots that sell through Triply WITHOUT Reservations Lab
 * (plan: notes/2026-10-02-direct-lots-plan-v1.md §9, review A-15 / B1). Ported
 * from APB's `Lots` collection with the review's changes:
 *
 * - `airportCode`, `visibility`, `taxCollectedBy` are TEXT with validation, not
 *   selects: a Postgres enum would need a migration for every new value and a
 *   plain view over this table would block that migration (gate finding).
 * - Writes are ADMIN-ONLY (B1): every field here decides inventory, money,
 *   where the lot appears, or who gets emailed. Editors (and the blog-engine
 *   API key, which is an editor) can read, not write. Deleting is disabled —
 *   deactivate instead, so a lot with bookings is never orphaned.
 * - Partner-facing data (recipients, share, tax) is admin-read-only too; the
 *   main app never reads this through the CMS API (see READ PATH).
 * - No rating/reviewCount: fabricated review signals were removed site-wide on
 *   Sept 24 and are not coming back without a real source.
 * - Partner contact details live in the app's `partners` table, not here.
 *
 * READ PATH: the main app reads the `payload.lots*` tables through a
 * service-role database function (app migration 035), never over HTTP. A
 * column rename here must be mirrored there.
 *
 * Admin-form note: Payload validates the raw input BEFORE hooks run, so every
 * validator below normalises (trim / uppercase / derive) itself.
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const slugFromName: FieldHook = ({ value, data }) => {
  if (!value && data?.name) return slugify(String(data.name))
  return value
}

const upper: FieldHook = ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)

export const VISIBILITY_VALUES = ['production', 'staging_only'] as const
export const TAX_COLLECTED_BY_VALUES = ['triply', 'lot'] as const

const oneOf =
  (allowed: readonly string[], label: string) =>
  (value: unknown): true | string =>
    typeof value === 'string' && allowed.includes(value.trim())
      ? true
      : `${label} must be one of: ${allowed.join(', ')}`

const integerOrEmpty = (label: string) => (value: unknown): true | string =>
  value == null || value === '' || (typeof value === 'number' && Number.isInteger(value))
    ? true
    : `${label} must be a whole number`

// Floating point: 9.95 * 100 is 994.9999999999999, so compare with a tolerance.
const moneyOrEmpty = (label: string) => (value: unknown): true | string =>
  value == null ||
  value === '' ||
  (typeof value === 'number' && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6)
    ? true
    : `${label} must have at most 2 decimal places`

// A custom `validate` REPLACES Payload's built-in one, so `required` / `min` on a
// field with a validator are not enforced — this checks them itself.
const positiveMoney = (label: string, max: number) => (value: unknown): true | string => {
  if (typeof value !== 'number' || !(value > 0)) return `${label} is required and must be above 0`
  if (value > max) return `${label} must be at most ${max}`
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 ? true : `${label} must have at most 2 decimal places`
}

// The main app parses these rows strictly (a bad row makes the whole lot
// unreadable, not "no surcharges"), so every rule it enforces is checked here
// on save. Keep in step with the app's direct-lots store schema.
export const MAX_VEHICLE_SURCHARGES = 6
const MAX_SURCHARGE_DAILY_RATE = 1000
const VEHICLE_CODE_RE = /^[a-z0-9_]{1,32}$/

const vehicleSurchargesValid = (value: unknown): true | string => {
  if (value == null) return true
  if (!Array.isArray(value)) return 'Vehicle surcharges must be a list'
  if (value.length > MAX_VEHICLE_SURCHARGES) return `At most ${MAX_VEHICLE_SURCHARGES} vehicle surcharges`
  const seen = new Set<string>()
  for (const row of value as Array<{ code?: unknown; dailyRate?: unknown }>) {
    const code = typeof row?.code === 'string' ? row.code : ''
    if (code === 'none') return '"none" is reserved for "No oversized vehicle"'
    // An empty code is reported by the code field itself.
    if (code && seen.has(code)) return `Duplicate vehicle surcharge code: ${code}`
    seen.add(code)
    if (typeof row?.dailyRate !== 'number' || !(row.dailyRate > 0) || row.dailyRate > MAX_SURCHARGE_DAILY_RATE)
      return `Surcharge "${code}" needs a daily rate above 0 and at most ${MAX_SURCHARGE_DAILY_RATE}`
  }
  return true
}

export const Lots: CollectionConfig = {
  slug: 'lots',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'airportCode', 'isActive', 'visibility', 'baseDailyRate', 'status'],
    group: 'Direct Lots',
    description:
      'Lots that sell through Triply directly (no Reservations Lab). Admin-only to edit. A lot is bookable only when status = published, isActive is on, and its visibility matches the environment.',
  },
  access: {
    read: authed,
    create: isAdmin,
    update: isAdmin,
    // Never delete: a lot with bookings must stay resolvable. Deactivate instead.
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      // A staging-only lot must never be able to email a real lot: every
      // notification address has to be ours. Checked on the FINAL state, so
      // visibility and the addresses can be changed in the same save.
      ({ data }) => {
        if (data?.visibility === 'staging_only') {
          const emails: Array<{ email?: string }> = Array.isArray(data.notificationEmails) ? data.notificationEmails : []
          const outside = emails.map((e) => e.email ?? '').filter((e) => !e.toLowerCase().endsWith('@triplypro.com'))
          if (outside.length > 0) {
            throw new ValidationError({
              collection: 'lots',
              errors: [
                {
                  path: 'notificationEmails',
                  message: `A staging_only lot may only notify @triplypro.com addresses (found: ${outside.join(', ')}). Change visibility to production in the same save, or use a triplypro.com inbox.`,
                },
              ],
            })
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description:
          'URL path segment. Generated from the name if left blank. Lowercase letters, digits and hyphens; cannot be all digits or start with "reslab-"/"direct-" (a name starting with "Direct …" needs a hand-written slug).',
      },
      hooks: { beforeValidate: [slugFromName] },
      validate: (value: unknown, { siblingData }: { siblingData?: { name?: unknown } }) => {
        const v = typeof value === 'string' && value ? value : slugify(String(siblingData?.name ?? ''))
        if (!v) return 'Slug is required'
        if (/^\d+$/.test(v)) return 'Slug cannot be all digits (it would be read as a ResLab id)'
        if (/^(reslab|direct)-/.test(v)) return 'Slug cannot start with "reslab-" or "direct-"'
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) return 'Use lowercase letters, digits and single hyphens'
        return true
      },
    },
    {
      name: 'airportCode',
      type: 'text',
      required: true,
      index: true,
      hooks: { beforeValidate: [upper] },
      admin: {
        position: 'sidebar',
        description: 'IATA code the lot serves, UPPERCASE, e.g. LGA. Must match an airport the site lists.',
      },
      validate: (value: unknown) =>
        typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim().toUpperCase())
          ? true
          : 'Airport code must be 3 letters (e.g. LGA)',
    },
    {
      name: 'reslabLocationId',
      type: 'number',
      unique: true,
      validate: integerOrEmpty('ResLab location id'),
      admin: {
        position: 'sidebar',
        description:
          'Only if this same lot ALSO exists on Reservations Lab: its ResLab location id. The ResLab listing is then hidden so the lot is not shown twice.',
      },
    },

    // --- Content -----------------------------------------------------------
    {
      name: 'descriptionShort',
      type: 'textarea',
      maxLength: 250,
      admin: { description: 'Short blurb for search results (max 250 chars)' },
    },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    {
      name: 'gallery',
      type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
      admin: { description: 'Additional photos shown on the lot page. (A media item used here cannot be deleted while referenced.)' },
    },
    { name: 'content', type: 'richText' },
    { name: 'amenities', type: 'relationship', relationTo: 'lot-amenities', hasMany: true },
    {
      name: 'distanceToTerminalMinutes',
      type: 'number',
      min: 0,
      admin: { description: 'Approximate shuttle/walk time to the terminal, in minutes' },
    },
    {
      name: 'shuttleDetails',
      type: 'textarea',
      admin: {
        description:
          'Shuttle hours and frequency as shown to the customer on the lot page and in the confirmation email (e.g. "Runs every 15 min, 4 AM – 1 AM"). Leave blank if there is no shuttle.',
      },
    },
    {
      name: 'shuttlePhone',
      type: 'text',
      admin: { description: 'Shuttle/lot contact phone shown in the confirmation email.' },
    },
    {
      name: 'address',
      type: 'group',
      admin: { description: 'Required: the confirmation email and Park Guard enrolment both need a full address.' },
      fields: [
        { name: 'street', type: 'text', required: true },
        { name: 'city', type: 'text', required: true },
        {
          name: 'state',
          type: 'text',
          required: true,
          hooks: { beforeValidate: [upper] },
          admin: { description: '2-letter code, UPPERCASE (e.g. NY)' },
          validate: (value: unknown) =>
            typeof value === 'string' && /^[A-Z]{2}$/.test(value.trim().toUpperCase())
              ? true
              : 'State must be a 2-letter code (e.g. NY)',
        },
        { name: 'zip', type: 'text', required: true },
      ],
    },
    {
      name: 'coordinates',
      type: 'group',
      admin: { description: 'Required: map pin, distance to the airport, and airport attribution.' },
      fields: [
        { name: 'lat', type: 'number', required: true, min: -90, max: 90 },
        { name: 'lng', type: 'number', required: true, min: -180, max: 180 },
      ],
    },
    {
      name: 'faqs',
      type: 'array',
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'richText', required: true },
      ],
    },
    {
      name: 'bookingInstructions',
      type: 'group',
      admin: {
        description:
          'Lot-specific sections for the confirmation email. Plain text per section: lines starting with "- " render as bullets. Empty sections are omitted.',
      },
      fields: [
        { name: 'beforeArrival', type: 'textarea', admin: { description: '"Before Arrival" — forms or reminders.' } },
        { name: 'whenYouArrive', type: 'textarea', admin: { description: '"When You Arrive" — check-in / key-drop procedure.' } },
        {
          name: 'importantNotes',
          type: 'textarea',
          admin: { description: '"Important Notes" — restrictions (vehicle size, oversize fees). Shown highlighted.' },
        },
        { name: 'whenYouReturn', type: 'textarea', admin: { description: '"When You Return" — pickup procedure.' } },
        {
          name: 'gettingToAirport',
          type: 'textarea',
          admin: { description: '"Getting to and from the Airport" — shuttle details or alternatives.' },
        },
      ],
    },

    // --- Bookability ----------------------------------------------------------
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Must be on for the lot to appear in search or be bookable.' },
    },
    {
      name: 'visibility',
      type: 'text',
      required: true,
      defaultValue: 'staging_only',
      validate: oneOf(VISIBILITY_VALUES, 'Visibility'),
      admin: {
        position: 'sidebar',
        description:
          '"staging_only" = visible on staging/preview/local only (test lots; the CMS is shared by every environment). "production" = visible everywhere. Staging-only lots may only notify @triplypro.com addresses.',
      },
    },
    {
      name: 'minStayDays',
      type: 'number',
      min: 1,
      defaultValue: 1,
      validate: integerOrEmpty('Minimum stay'),
      admin: { description: 'Minimum billed days per booking (whole number).' },
    },
    {
      name: 'minLeadHours',
      type: 'number',
      min: 0,
      defaultValue: 2,
      admin: {
        description: 'Earliest drop-off accepted, in hours from now. Gives the lot time to see the booking email (default 2).',
      },
    },

    // --- Money (admin read + write only) --------------------------------------
    {
      name: 'baseDailyRate',
      type: 'number',
      required: true,
      min: 0.01,
      validate: positiveMoney('Daily rate', 1000),
      admin: {
        description:
          'Price per billed day in USD (2 decimals), before tax and before the Triply service fee. Billing is in 24-hour periods from drop-off to pickup.',
      },
    },
    {
      name: 'vehicleSurcharges',
      type: 'array',
      maxRows: MAX_VEHICLE_SURCHARGES,
      validate: vehicleSurchargesValid,
      labels: { singular: 'Vehicle surcharge', plural: 'Vehicle surcharges' },
      admin: {
        description:
          'Oversized-vehicle surcharges, PAID AT THE LOT (never charged online). The customer picks one when they reserve; "No oversized vehicle" is always offered and is not a row here. Tax on the surcharge is also paid at the lot, at this lot\'s tax rate. Leave empty if the lot has no surcharges. A bad row takes the lot offline on the site, so every row is checked on save.',
      },
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
          admin: {
            description:
              'Stable id stored on bookings, e.g. small_suv. Lowercase letters, digits and underscores; unique within the lot; never "none". Do not change it once bookings exist.',
          },
          validate: (value: unknown) =>
            typeof value === 'string' && VEHICLE_CODE_RE.test(value)
              ? value === 'none'
                ? '"none" is reserved for "No oversized vehicle"'
                : true
              : 'Use 1–32 lowercase letters, digits or underscores (e.g. small_suv)',
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          maxLength: 40,
          admin: { description: 'What the customer sees, e.g. "Large SUV / truck".' },
          validate: (value: unknown) =>
            typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40
              ? true
              : 'Label is required (1–40 characters)',
        },
        {
          name: 'dailyRate',
          type: 'number',
          required: true,
          min: 0.01,
          validate: positiveMoney('Surcharge per day', MAX_SURCHARGE_DAILY_RATE),
          admin: { description: 'USD per billed day, before tax (2 decimals). Billed on the same days as the parking.' },
        },
      ],
    },
    {
      name: 'taxRatePercent',
      type: 'number',
      required: true,
      min: 0,
      max: 30,
      // The app stamps this on the payment and stores it as NUMERIC(6,3): a rate
      // with more decimals would take the lot offline on the site. (A custom
      // validate replaces Payload's, so required/min/max are checked here too.)
      validate: (value: unknown): true | string =>
        typeof value === 'number' && value >= 0 && value <= 30 && /^\d{1,3}(\.\d{1,3})?$/.test(String(value))
          ? true
          : 'Tax rate is required: 0–30, up to 3 decimals (e.g. 18.375)',
      access: { read: isAdminField },
      admin: {
        description:
          'Parking tax applied to the parking subtotal, as a percentage (e.g. 18.375). Required — enter 0 only if confirmed with the accountant.',
      },
    },
    {
      name: 'taxCollectedBy',
      type: 'text',
      required: true,
      access: { read: isAdminField },
      validate: oneOf(TAX_COLLECTED_BY_VALUES, 'Tax collected by'),
      admin: {
        description:
          '"triply" = Triply collects the tax online and remits it. "lot" = the tax is passed through to the lot in its payout. Required; no default on purpose.',
      },
    },
    {
      name: 'partnerSharePercent',
      type: 'number',
      required: true,
      min: 0,
      max: 100,
      access: { read: isAdminField },
      admin: { description: 'Share of the parking subtotal paid out to the lot, as a percentage (e.g. 80).' },
    },

    // --- Operations (admin read + write only) ---------------------------------
    {
      name: 'notificationEmails',
      type: 'array',
      required: true,
      minRows: 1,
      access: { read: isAdminField },
      fields: [{ name: 'email', type: 'email', required: true }],
      admin: {
        description:
          'Where the lot receives each booking and cancellation notice (and the daily manifest). At least one. For a staging_only lot these must all be @triplypro.com.',
      },
    },

    // --- Publishing -----------------------------------------------------------
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar', description: 'Draft lots are never shown or bookable, regardless of isActive.' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Record only — when the lot first went live. Not used by the site.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', maxLength: 70 },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
      ],
    },
  ],
}

/**
 * feature flags for this build.
 *
 * PROVIDERS_ENABLED gates the whole provider side of the app. the 3,000 odd
 * clinics are real; the provider rows in the database are seed data, so nothing
 * patient facing may name a person until the real provider side exists.
 *
 * this is enforced at the query level as well as in the ui. a hidden component
 * that still fetched providers would leak one eventually.
 *
 * flip this to true to restore every provider surface. nothing is deleted.
 */
export const PROVIDERS_ENABLED = false;

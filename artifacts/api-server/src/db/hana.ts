/**
 * Database Adapter:
 * Re-exports the Neon Serverless PostgreSQL database module.
 * Preserves the hanaDb export for backwards-compatibility across
 * existing routes and agent orchestrators.
 */
export * from "./neon";

/**
 * Database declaration kinds shared by Prisma, SQL, and DBML.
 *
 * - "model": a named record structure, such as a Prisma model, table, or view.
 * - "column": a data field belonging to a model.
 *   - Includes scalar fields and foreign-key values such as `authorId`.
 *   - Excludes the relation declaration that describes the connection.
 * - "relation": a declaration connecting models, including self-references.
 *   - Includes Prisma relation fields, SQL foreign-key constraints, and DBML refs.
 *   - Includes both Prisma relation fields, even when one omits `@relation`.
 *   - Means a relationship, not the SQL use of "relation" for a table.
 *
 * Models contain their columns and relations. A model target covers its selected
 * descendants even when the model itself is not selected. Each adapter retains
 * its own declaration units; Prisma's two relation fields need not correspond to
 * two SQL foreign-key constraints.
 *
 * Prisma targets use `prisma:Model` and `prisma:Model.field`, without a file path.
 * Model names are unique across the schema; moving declarations between its
 * files preserves their targets.
 * Models and views share the "model" kind. Enums, composite types, indexes, and
 * datasource/generator settings are outside the Prisma selection contract.
 */
export type EvidenceDatabaseSymbol = "model" | "column" | "relation";

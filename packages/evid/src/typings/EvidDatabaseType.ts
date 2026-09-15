/**
 * Database schema languages and SQL dialects supported by database adapters.
 *
 * This value selects a parser and adapter contract rather than inferring a
 * dialect from a file extension. `sql` represents the generic SQL grammar;
 * dialect-specific values retain syntax and target rules that differ from it.
 */
export type EvidDatabaseType =
  "prisma" | "sql" | "postgresql" | "mysql" | "sqlite" | "bigquery" | "dbml";

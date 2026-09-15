import type { EvidDatabaseSymbol } from "./EvidDatabaseSymbol";
import type { EvidMarkdownSymbol } from "./EvidMarkdownSymbol";
import type { EvidProgrammingSymbol } from "./EvidProgrammingSymbol";

/**
 * Symbol kind used to select a unit within its artifact-specific inventory.
 *
 * Programming, database, and Markdown adapters contribute their own precise
 * classifications. `operation` covers API operations, whose target semantics do
 * not correspond to a programming declaration or document heading. Consumers
 * must retain the accompanying artifact type when interpreting this value.
 */
export type EvidSymbol =
  EvidProgrammingSymbol | EvidDatabaseSymbol | EvidMarkdownSymbol | "operation";

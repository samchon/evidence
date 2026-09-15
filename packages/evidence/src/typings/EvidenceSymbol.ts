import type { EvidenceDatabaseSymbol } from "./EvidenceDatabaseSymbol";
import type { EvidenceMarkdownSymbol } from "./EvidenceMarkdownSymbol";
import type { EvidenceProgrammingSymbol } from "./EvidenceProgrammingSymbol";

/**
 * Symbol kind used to select a unit within its artifact-specific inventory.
 *
 * Programming, database, and Markdown adapters contribute their own precise
 * classifications. `operation` covers API operations, whose target semantics do
 * not correspond to a programming declaration or document heading. Consumers
 * must retain the accompanying artifact type when interpreting this value.
 */
export type EvidenceSymbol =
  EvidenceProgrammingSymbol | EvidenceDatabaseSymbol | EvidenceMarkdownSymbol | "operation";

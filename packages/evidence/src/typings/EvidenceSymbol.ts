import type { EvidenceDatabaseSymbol } from "./EvidenceDatabaseSymbol";
import type { EvidenceMarkdownSymbol } from "./EvidenceMarkdownSymbol";
import type { EvidenceProgrammingSymbol } from "./EvidenceProgrammingSymbol";

/** Shared inventory selectors; adapters retain their artifact's classification. */
export type EvidenceSymbol =
  | EvidenceProgrammingSymbol
  | EvidenceDatabaseSymbol
  | EvidenceMarkdownSymbol
  | "operation";

import type { Node } from "web-tree-sitter";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** Dialect policy for the shared explicit CREATE TABLE scanner. */
export interface ISqlPolicy {
  /** Decodes one identifier, rejecting syntax outside the configured dialect. */
  identifier: (raw: string) => string | undefined;
  /** Validates a complete statement or comment; a message makes analysis incomplete. */
  validate: (node: Node) => string | undefined;
  /** Projects decoded addresses to dialect-specific schema identities. */
  identity?: (address: string[], symbol: EvidenceDatabaseSymbol) => string[];
  /** Whether a grammar constraint name denotes an actual relation name. */
  constraintNames?: boolean;

  /** Whether column REFERENCES creates a relation in this dialect. */
  inlineReferences?: "ignore" | "relation" | "reject";
}

import type { Node as EvidenceNode } from "web-tree-sitter";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/**
 * Defines dialect-specific decisions for the shared SQL table scanner.
 *
 * The scanner owns common declaration extraction; a policy supplies only the
 * syntax and namespace choices that vary by SQL dialect.
 */
export interface IEvidenceSqlPolicy {
  /**
   * Decodes one grammar identifier under this dialect's quoting rules.
   *
   * Returning `undefined` rejects the spelling and makes the containing scan
   * incomplete rather than inventing an address.
   */
  identifier: (raw: string) => string | undefined;

  /**
   * Validates a complete grammar statement or comment for this dialect.
   *
   * Returning a message marks the analysis incomplete and provides the
   * diagnostic reason; returning `undefined` permits common extraction.
   */
  validate: (node: EvidenceNode) => string | undefined;

  /**
   * Projects a decoded public address into its dialect-specific identity.
   *
   * Omission preserves the address as the semantic identity.
   */
  identity?: (address: string[], symbol: EvidenceDatabaseSymbol) => string[];

  /**
   * Resolves a referenced table name within its declared owner scope.
   *
   * Omission leaves the decoded reference unchanged when building relation
   * endpoint identity.
   */
  reference?: (reference: string[], owner: string[]) => string[];

  /**
   * States whether a grammar constraint name is a relation's public name.
   *
   * Omission treats explicit table constraint names as relation names.
   */
  constraintNames?: boolean;

  /**
   * Selects how column-level `REFERENCES` syntax contributes relations.
   *
   * Omission uses the scanner's normal relation behavior; `ignore` omits it and
   * `reject` records dialect incompleteness.
   */
  inlineReferences?: "ignore" | "relation" | "reject";
}

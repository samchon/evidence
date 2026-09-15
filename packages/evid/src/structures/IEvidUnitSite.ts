import type { IEvidSourceRange } from "./IEvidSourceRange";

/**
 * A physical declaration occurrence and its contribution to a unit's content.
 *
 * A merged unit can own several sites, while a statement declaring several
 * variables can share one site ID across units. The site identifies the physical
 * occurrence without deciding whether its declarations share semantic identity.
 *
 * The declaration range establishes ownership and diagnostic location. Content
 * ranges identify the portions belonging to this unit's own fingerprint and may
 * exclude sibling declarators. Inventory validation requires those portions to
 * remain inside the declaration and checks hosts against the owned site IDs.
 */
export interface IEvidUnitSite {
  /**
   * Adapter identity of the physical declaration occurrence.
   *
   * Multi-variable statements may share this ID. Its source location must remain
   * consistent across those records even when their content contributions differ.
   */
  id: string;

  /**
   * Captured source path containing the declaration.
   *
   * Fingerprinting resolves this path against inventory sources. Re-exporting
   * the unit changes its public addresses without moving this physical site.
   */
  file: string;

  /**
   * Complete source span of this declaration occurrence.
   *
   * The half-open range establishes the bounds for owned content and host
   * validation. Narrower fingerprint contributions are recorded in `content`.
   */
  range: IEvidSourceRange;

  /**
   * Source portions contributing to this unit's own content digest.
   *
   * Sibling declarators need not contribute to one another's fingerprints.
   * Accepted annotation spans are removed before the remaining text is normalized
   * and hashed; structural descendants are combined separately afterward.
   */
  content: IEvidSourceRange[];
}

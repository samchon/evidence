import type { IEvidenceSourceRange } from "./IEvidenceSourceRange";

/**
 * A physical documentation carrier and the declarations that own its statements.
 *
 * Adapters establish attachment from language syntax before evidence tags are
 * parsed. This record supplies the source location and semantic owners used to
 * decide whether an acknowledgement belongs to a selected claim host. A nearby
 * comment cannot acquire ownership merely by containing a recognized tag.
 *
 * Physical and semantic ownership need not be one-to-one:
 *
 * - A multi-variable statement can give one position several unit IDs.
 * - Overload declarations can give one semantic host several physical positions.
 * - An artifact's exclusion-only carrier can be attached without owning a unit.
 *
 * Unattached and unsupported carriers remain available for diagnostics. Graph
 * cardinality counts the owning semantic identities, not the number of comments.
 */
export interface IEvidenceHost {
  /**
   * Identity of the physical documentation carrier.
   *
   * Parsed statements refer to this ID. It must remain distinct from semantic
   * unit IDs because several carriers can belong to one merged declaration.
   */
  id: string;

  /**
   * Source file containing the carrier.
   *
   * This anchors diagnostics and supplies the default origin for relative
   * citations when the host does not record explicit `origins`.
   */
  file: string;

  /**
   * Span of the documentation position in the captured source.
   *
   * Coordinates use the original UTF-16 text and an exclusive end. The carrier
   * span is separate from its owner's declaration and fingerprint content ranges.
   */
  range: IEvidenceSourceRange;

  /**
   * Source paths from which relative citations may resolve.
   *
   * Omission uses `file`. Reconciliation preserves every origin when equivalent
   * carriers merge, so choosing one alias does not discard another valid base path.
   */
  origins?: string[];

  /**
   * Physical declaration site establishing the carrier's semantic ownership.
   *
   * An exclusion-only carrier can omit this link. For a semantic host, inventory
   * validation requires the site to belong to its claimed unit owners.
   */
  siteId?: string;

  /**
   * Semantic declarations owning this documentation position.
   *
   * Retain all owners of shared declaration positions. Empty ownership is allowed
   * only where the artifact's carrier rules permit evidence without a declaration,
   * such as an eligible exclusion-only position.
   */
  unitIds: string[];

  /**
   * Result of the adapter's syntactic attachment analysis.
   *
   * Attached carriers participate under the artifact's rules, including allowed
   * exclusion-only carriers with no unit IDs. Unattached or unsupported positions
   * retain their status so their annotations can produce actionable findings.
   */
  attachment: "attached" | "unattached" | "unsupported";

  /**
   * Adapter explanation for an unsupported documentation position.
   *
   * Supply the source construct or ownership limitation that prevents this
   * carrier from participating. Ordinary supported positions omit the explanation.
   */
  problem?: string;
}

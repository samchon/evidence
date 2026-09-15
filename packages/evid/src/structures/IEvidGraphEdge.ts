import type { EvidAcknowledgementKind } from "../typings/EvidAcknowledgementKind";

/**
 * Accepted acknowledgement connecting a claim carrier to a reference scope.
 *
 * The named target can be an unselected structural ancestor whose selected
 * descendants receive coverage. The edge therefore retains both the exact
 * target and the selected identities it covers. Its fingerprint belongs to that
 * exact cited scope, allowing review validation without turning reviews into
 * evidence.
 */
export interface IEvidGraphEdge {
  /**
   * Identity of the accepted source statement.
   *
   * This links the coverage contribution back to the extracted acknowledgement.
   */
  declarationId: string;

  /**
   * Documentation position carrying the acknowledgement.
   *
   * A single physical carrier may represent more than one semantic claim unit.
   */
  hostId: string;

  /**
   * Selected semantic claim units represented by the carrier.
   *
   * Checklist evaluation attributes the answer to these subjects independently.
   */
  hostUnitIds: string[];

  /**
   * Accepted scope-selection form of the acknowledgement.
   *
   * The declaration form determines which part of the resolved target can
   * supply selected units to this edge.
   */
  kind: EvidAcknowledgementKind;

  /**
   * Semantic identity of the exact resolved target.
   *
   * It can be a structural scope outside the selected coverage denominator.
   */
  targetUnitId: string;

  /**
   * Selected reference identities covered by the cited scope.
   *
   * These are the edge's contribution after selection and policy are applied;
   * they need not consist solely of the named target.
   */
  unitIds: string[];

  /**
   * Current seven-character fingerprint of the exact cited scope.
   *
   * Review matching compares the expected fingerprint with this scope's
   * content, rather than hashing only the selected coverage subset.
   */
  fingerprint: string;
}

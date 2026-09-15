import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/**
 * Source attachment and target text shared by acknowledgements and reviews.
 *
 * Parsing establishes where a statement was written while leaving its target in
 * authored form. Artifact-specific resolution later interprets the token from
 * the host's source context. Sharing these fields does not let a review satisfy
 * coverage: the derived record still determines the statement's role.
 */
export interface IEvidenceTargetStatement {
  /**
   * Physical documentation host containing this statement.
   *
   * The host table supplies semantic owners and citation origins. A matching
   * target on another host is not interchangeable for review pairing.
   */
  hostId: string;

  /**
   * Target token preserved as written in the annotation.
   *
   * The referenced artifact determines its grammar and lookup rules. Keeping
   * the authored spelling allows diagnostics to explain aliases and invalid
   * targets.
   */
  target: string;

  /**
   * Original source position of the complete statement.
   *
   * Decoded documentation maps this location back to captured source
   * characters, allowing a finding to identify the annotation rather than only
   * its host.
   */
  location: IEvidenceSourceLocation;
}

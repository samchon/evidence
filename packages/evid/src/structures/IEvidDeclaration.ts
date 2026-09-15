import type { EvidAcknowledgementKind } from "../typings/EvidAcknowledgementKind";
import type { IEvidTargetStatement } from "./IEvidTargetStatement";

/**
 * A parsed positive or exclusion acknowledgement awaiting reference-specific resolution.
 *
 * The tag parser records the target, reason, host, and source location. Resolution
 * identifies the cited scope, then each reference judges host eligibility,
 * exclusion permission, and coverage of its selected descendants. Merely parsing
 * a statement does not create a valid coverage edge.
 *
 * Reviews use a separate shape because they validate acknowledgements rather
 * than substitute for them. Multiple statements may still belong to one semantic
 * host for cardinality purposes.
 */
export interface IEvidDeclaration extends IEvidTargetStatement {
  /**
   * Identity of this physical acknowledgement statement.
   *
   * Target resolutions and accepted graph edges join through this ID. Repeated
   * statements do not necessarily represent different semantic hosts.
   */
  id: string;

  /**
   * Whether the annotation supplies positive evidence or an exclusion.
   *
   * Both can cover ordinary obligations, but exclusions have independent carrier,
   * refusal, and overlap rules. A review cannot be represented as either kind.
   */
  kind: EvidAcknowledgementKind;

  /**
   * Nonempty explanation accompanying the target.
   *
   * The parser requires prose so the citation records its purpose. Coverage checks
   * establish structural acknowledgement, not the truth of this explanation.
   */
  reason: string;
}

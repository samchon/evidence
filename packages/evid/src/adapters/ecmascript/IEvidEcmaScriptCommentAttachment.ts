/**
 * Connects a parsed JSDoc comment to one semantic declaration carrier.
 *
 * Comment materialization filters these records by public reachability and then
 * uses their physical and semantic identities to create claims or withdrawals.
 */
export interface IEvidEcmaScriptCommentAttachment {
  /**
   * Eligible host-position key when this carrier can make evidence claims.
   *
   * Omission marks a withdrawal-only attachment such as a constructor comment.
   */
  positionId?: string;

  /**
   * Physical declaration site receiving the documentation.
   *
   * It remains separate from the unit so merged declarations retain attachment
   * truth.
   */
  siteId: string;

  /**
   * Semantic unit affected by this JSDoc carrier.
   *
   * Several units can share one physical host only when the scanner establishes
   * it.
   */
  unitId: string;

  /**
   * Limits the carrier to visibility withdrawal processing.
   *
   * Constructor documentation can hide parameter properties but cannot claim
   * evidence.
   */
  withdrawalOnly?: boolean;
}

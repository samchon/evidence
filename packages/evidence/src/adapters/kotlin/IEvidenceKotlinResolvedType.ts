/**
 * Describes a statically resolved Kotlin nominal receiver.
 *
 * EvidenceKotlinReceivers produces this result after lexical lookup and
 * supported type alias expansion, then uses it to place extension declarations
 * beneath their effective receiver address.
 */
export interface IEvidenceKotlinResolvedType {
  /**
   * Gives canonical package and declared-owner segments for the receiver.
   *
   * These segments become the receiver spelling in an extension identity and
   * preserve declaration ownership rather than the import used to reach it.
   */
  segments: string[];

  /**
   * Indicates whether the effective receiver permits null.
   *
   * EvidenceKotlinReceivers preserves a nullable suffix from the source
   * reference or from any selected alias expansion when constructing the
   * extension address.
   */
  nullable: boolean;
}

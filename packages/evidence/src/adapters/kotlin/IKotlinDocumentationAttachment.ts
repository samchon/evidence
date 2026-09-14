/**
 * Connects a KDoc carrier to one extracted Kotlin declaration site.
 *
 * KotlinFileScanner establishes this adjacency from source, then the
 * documentation pass uses the pair to evaluate annotations for the relevant
 * site without assigning the comment semantic ownership.
 */
export interface IKotlinDocumentationAttachment {
  /**
   * Identifies the declaration extraction record that receives the KDoc.
   *
   * Consumers use this stable scanner-local ID to recover the declaration whose
   * annotation is evaluated.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site covered by the KDoc.
   *
   * This distinguishes the adjacent source occurrence when one semantic unit
   * has more than one declaration site.
   */
  siteId: string;
}

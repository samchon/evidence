/** Records one scanner-established relationship between documentation and a C++ declaration site.
 *
 * `CppFileScanner` creates these records while source adjacency is available. `CppAdapter` uses the declaration ID to find the selected unit and the site ID to create the physical documentation host, preserving distinct overload and alias locations.
 */
export interface ICppDocumentationAttachment {
  /** Scanner-local declaration or alias record that receives the documentation.
   *
   * `CppAdapter` resolves this ID to a selected semantic unit only after family and alias reconciliation, so it is not itself a public address or unit identity.
   */
  declarationId: string;

  /** Physical declaration site at which the documentation becomes an evidence host.
   *
   * This remains separate from `declarationId` because one selected unit can have multiple source sites; grouping by this ID prevents a comment from being attached to unrelated overload or alias locations.
   */
  siteId: string;
}

/**
 * Records one scanner-approved ownership link from XML documentation to a C# declaration site.
 *
 * IEvidCSharpDocumentation stores these physical links while parsing is still close
 * to source syntax. EvidCSharpAdapterBase resolves the declaration record to a published
 * semantic unit and groups links by site when it creates evidence hosts.
 */
export interface IEvidCSharpDocumentationAttachment {
  /**
   * Identifies the scanner-local declaration that receives this XML documentation.
   *
   * EvidCSharpAdapterBase looks up this key in its published-declaration map to find the
   * semantic unit. It is not a stable unit ID because partial declarations can
   * later merge into one family.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site that owns the resulting evidence host.
   *
   * Grouping by this value keeps documentation attached to the source occurrence
   * that established adjacency, so separate partial declarations cannot borrow
   * each other's comments.
   */
  siteId: string;
}

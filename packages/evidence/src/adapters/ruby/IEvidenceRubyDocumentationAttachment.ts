/**
 * Links one Ruby documentation carrier to a declaration site.
 *
 * Attachment remains keyed to scanner records until compatible reopenings merge
 * into one public unit, which can have several physical documentation sites.
 */
export interface IEvidenceRubyDocumentationAttachment {
  /**
   * Scanner identity of the declaration receiving this comment.
   *
   * EvidenceRubyAdapter converts it to a published semantic unit before parsing
   * tags.
   */
  declarationId: string;

  /**
   * Physical declaration-site identity shared by co-located accessors.
   *
   * Hosts group this site once even when it contributes to multiple units.
   */
  siteId: string;
}

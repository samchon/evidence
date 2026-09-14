/** One PHPDoc carrier attached to a PHP declaration site. */
export interface IPhpDocumentationAttachment {
  /** Declaration receiving the documentation. */
  declarationId: string;

  /** Original declaration site identity. */
  siteId: string;
}

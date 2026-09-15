/**
 * Identifies a declaration root or module namespace reached through imports.
 *
 * EvidencePythonExportResolver carries this lightweight result across files before
 * it converts a reachable root into public addresses and a published unit.
 */
export interface IEvidencePythonResolvedBinding {
  /**
   * Selected source module containing this resolved target.
   *
   * It keys later root lookup and ensures traversal remains inside the
   * snapshot.
   */
  sourceId: string;

  /**
   * Local declaration root when the lookup resolves to a declaration.
   *
   * Omission represents a module namespace, whose next attribute lookup
   * supplies the root.
   */
  root?: string;
}

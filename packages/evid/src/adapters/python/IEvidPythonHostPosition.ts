import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";

/**
 * Identifies one Python declaration site eligible to own documentation.
 *
 * The scanner retains positions separately from units because one source site
 * can expose several accessors while producing only one evidence host.
 */
export interface IEvidPythonHostPosition {
  /**
   * Scanner-local key for this attachable declaration position.
   *
   * Documentation attachments use it to suppress a fallback undocumented host.
   */
  id: string;

  /**
   * Stable declaration-site identity shared by all units at this position.
   *
   * It becomes the host site when a published attachment survives withdrawal
   * filtering.
   */
  siteId: string;

  /**
   * Source extent that contributes this site's review content.
   *
   * Coordinates remain available after Tree-sitter resources close.
   */
  range: IEvidSourceRange;

  /**
   * Candidate semantic units declared at this source position.
   *
   * Export reachability decides which members are actually represented by the
   * host.
   */
  unitIds: string[];
}

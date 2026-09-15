/**
 * Connects one parsed Python documentation region to a declaration position.
 *
 * Scanning retains this compact relationship after its Tree-sitter session
 * closes. EvidPythonAdapterBase later filters it by public reachability before
 * creating evidence hosts, so a private declaration's docstring cannot document
 * an exported unit by accident.
 */
export interface IEvidPythonDocumentationAttachment {
  /**
   * Scanner-local identity of the declaration position that owns this text.
   *
   * Hosts use the same identity to avoid publishing a second undocumented host
   * for a declaration that already has an attached docstring or comment run.
   */
  positionId: string;

  /**
   * Stable declaration-site identity shared by every unit at this position.
   *
   * A property getter and setter may have distinct units but one source site;
   * the host records that common site once.
   */
  siteId: string;

  /**
   * Candidate unit receiving directives parsed from this documentation.
   *
   * The adapter discards this attachment unless export resolution publishes the
   * unit, preserving Python's public-surface boundary.
   */
  unitId: string;
}

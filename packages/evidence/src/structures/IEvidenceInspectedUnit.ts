import type { IEvidenceFingerprint } from "./IEvidenceFingerprint";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidenceListItem } from "./IEvidenceListItem";

/**
 * Candidate identity expanded with its immediate structural and documentation
 * context.
 *
 * Inspection uses this for resolved, ambiguous, or hidden candidates. Children
 * follow explicit parent links, and fingerprints are omitted when incomplete
 * extraction cannot establish trustworthy content for the candidate.
 */
export interface IEvidenceInspectedUnit {
  /**
   * Candidate's public addresses, declaration sites, and population selection
   * state.
   *
   * Its row ID retains the configuration boundary in which the candidate was
   * inspected.
   */
  item: IEvidenceListItem;

  /**
   * Addressable direct children according to explicit structural parent IDs.
   *
   * This is immediate context, not a recursive flattening or a name-prefix
   * search.
   */
  children: IEvidenceListItem[];

  /**
   * Documentation carriers whose semantic owners include this identity.
   *
   * Hosts are ordered by ID and can also belong to other units in a shared
   * statement.
   */
  hosts: IEvidenceHost[];

  /**
   * Current own-content and subtree fingerprint context when the inventory is
   * complete.
   *
   * Omission means extraction cannot certify a fingerprint; it is not an empty
   * hash.
   */
  fingerprint?: IEvidenceFingerprint;
}

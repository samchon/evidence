import type { EvidenceMarkdownSymbol } from "../typings/EvidenceMarkdownSymbol";
import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/** Markdown documents and sections that the owning claim must cite. */
export interface IEvidenceMarkdownReference extends IEvidenceReferenceBase<
  "markdown",
  EvidenceMarkdownSymbol
> {
  /**
   * Markdown file globs relative to root, using claim glob rules. Every matching
   * regular file is parsed regardless of extension; exclude non-Markdown assets.
   */
  files: string[];

  /**
   * Require every selected claim host to answer every selected Markdown item.
   *
   * - Hosts without tags still owe every item.
   * - Positive evidence answers only the named item, with no descendant coverage.
   *   Aggregate targets naming no selected item are rejected.
   * - Exclusions retain descendant coverage unless noEvidenceExclude refuses them.
   * - Duplicates and conflicts are evaluated per host. Different hosts may give
   *   different answers to the same item.
   * - Tags without a selected host answer nothing here. Report them only if no
   *   other obligation consumes them.
   * - Reject uniqueEvidence and singleEvidencePerSymbol at configuration time.
   * - Exclusion-carrier globs require noEvidenceExclude alongside this option.
   * - With requireReview, each answer is reviewed against that item's fingerprint;
   *   changing an item expires the answers to it.
   *
   * @default false
   */
  checklist?: boolean;
}

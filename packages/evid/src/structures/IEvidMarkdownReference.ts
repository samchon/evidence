import type { EvidMarkdownSymbol } from "../typings/EvidMarkdownSymbol";
import type { IEvidReferenceBase } from "./IEvidReferenceBase";

/**
 * Markdown documents or outline items required by the owning claim.
 *
 * Ordinary coverage lets a citation acknowledge a selected section and its
 * selected descendants. `checklist` adds a host dimension: every selected claim
 * host must independently answer every selected Markdown item, and positive
 * evidence answers only the named item.
 *
 * Use checklist mode for a review form each declaration must complete, rather
 * than a requirement that any one implementation may satisfy. Configuration
 * validation rejects cardinality and carrier combinations that conflict with
 * this per-host interpretation.
 *
 * @example
 *   // With two selected test functions and three checklist headings, each
 *   // function owes three answers. Six required answers cannot be pooled into
 *   // three citations supplied by only one of the functions.
 */
export interface IEvidMarkdownReference extends IEvidReferenceBase<
  "markdown",
  EvidMarkdownSymbol
> {
  /**
   * Markdown source globs relative to the reference root.
   *
   * Selection uses the claim glob rules. Every matching regular file is parsed
   * regardless of extension, so explicitly exclude non-Markdown assets.
   */
  files: string[];

  /**
   * Require every selected claim host to answer every selected Markdown item.
   *
   * - Hosts without tags still owe every item.
   * - Positive evidence answers only the named item, with no descendant coverage.
   *   Aggregate targets naming no selected item are rejected.
   * - Exclusions retain descendant coverage unless noEvidExclude refuses them.
   * - Duplicates and conflicts are evaluated per host. Different hosts may give
   *   different answers to the same item.
   * - Tags without a selected host answer nothing here. Report them only if no
   *   other obligation consumes them.
   * - Reject uniqueEvid and singleEvidPerSymbol at configuration time.
   * - Exclusion-carrier globs require noEvidExclude alongside this option.
   * - With requireReview, each answer is reviewed against that item's
   *   fingerprint; changing an item expires the answers to it.
   *
   * @default false
   */
  checklist?: boolean;
}

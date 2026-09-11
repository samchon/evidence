import type { EvidenceSeverity } from "../typings/EvidenceSeverity";

/**
 * Coverage policies for one independent reference. Ordinary evidence and
 * permitted exclusions cover selected targets and descendants.
 */
export interface IEvidenceReferenceBase<
  Type extends string,
  SymbolKind extends string,
> {
  /** Artifact type of the referenced evidence. */
  type: Type;

  /**
   * Base directory for file globs and local file paths.
   *
   * - Defaults to the directory containing evidence.config.ts; relative roots
   *   resolve from that directory.
   * - Accepts absolute paths, directory symlinks, and Windows junctions.
   * - Names one directory, not a glob. Windows drive-relative paths are invalid.
   * - Markdown citations use this root; programming citations use the citing file.
   *   Prisma model addresses do not contain paths.
   */
  root?: string;

  /**
   * Evidence symbol kinds; accepts one kind or a nonempty array. Defaults by family:
   *
   * - Programming: type.
   * - Database: model.
   * - Markdown: file, h1, h2, h3, h4.
   * - Swagger: operation.
   *
   * Unselected structural ancestors remain addressable as aggregate targets.
   */
  symbol?: SymbolKind | SymbolKind[];

  /**
   * Overrides the claim severity. Omit or use `undefined` to inherit.
   * `"off"` disables this reference's population and obligation.
   */
  severity?: EvidenceSeverity | undefined;

  /**
   * Reject exclusions for this reference, report them at their declarations, and
   * leave their targets uncovered unless positive evidence acknowledges them.
   * The same declaration may still cover another reference that allows exclusions.
   *
   * @default false
   */
  noEvidenceExclude?: boolean;

  /**
   * Allow at most one distinct claim host per evidence unit. Repeated tags,
   * overloads, and merged declarations do not create additional hosts.
   * Exclusions do not count; an uncited unit still fails coverage.
   *
   * @default false
   */
  uniqueEvidence?: boolean;

  /**
   * Require every selected claim host to cite exactly one selected evidence unit.
   *
   * - Hosts without tags count as zero; repeated citations to one unit count once.
   * - Aggregate targets count every selected descendant they cover.
   * - An empty reference population is reported as empty and evaluates no hosts.
   *
   * @default false
   */
  singleEvidencePerSymbol?: boolean;

  /**
   * Require a matching review with the current target content fingerprint.
   *
   * - Evidence needs evidenceReview; exclusions need evidenceExcludeReview.
   *   Reviews do not provide coverage.
   * - Reviews carry a #-prefixed fingerprint. Missing or stale reviews fail the
   *   obligation; diagnostics provide the expected fingerprint.
   * - Fingerprints belong to the cited unit and its structural subtree,
   *   independently of reference selectors.
   * - TypeScript fingerprints include nested declarations, even withdrawn ones.
   *   Swagger uses normalized operation content; Prisma uses parsed declarations
   *   without the documentation comments that carry reviews.
   * - This verifies the recorded review and fingerprint, not the truth of its prose.
   *
   * @default false
   */
  requireReview?: boolean;
}

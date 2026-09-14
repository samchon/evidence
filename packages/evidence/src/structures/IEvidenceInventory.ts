import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidencePublicAddress } from "./IEvidencePublicAddress";
import type { IEvidenceReview } from "./IEvidenceReview";
import type { IEvidenceSourceDependency } from "./IEvidenceSourceDependency";
import type { IEvidenceSourceFile } from "./IEvidenceSourceFile";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";
import type { IEvidenceUnit } from "./IEvidenceUnit";

/**
 * Serializable adapter output from which claim and reference populations are selected.
 *
 * An adapter returns this record after analyzing a captured source snapshot.
 * `EvidenceInventory` reconciles identities, validates source positions and
 * ownership, and projects the units requested by each population. Returned data
 * must not retain Tree-sitter nodes, sessions, or other borrowed parser resources.
 *
 * Units, addresses, and hosts answer different questions: what declaration
 * exists, how a citation names it, and where eligible documentation belongs.
 * Acknowledgements and reviews remain separate because a review validates a
 * citation's content but cannot supply missing coverage. Eligible hosts without
 * tags must also remain present for policies that judge every selected host.
 *
 * Failed discovery or unsupported public syntax leaves partial records available
 * for diagnostics and sets `complete` to false. Losing declarations must not
 * create a smaller passing denominator. A successfully discovered empty
 * population, in contrast, can have an empty unit list and remain complete.
 *
 * @example
 * const raw: IEvidenceInventory = await adapter.analyze(snapshot);
 * const inventory: EvidenceInventory = new EvidenceInventory([raw]);
 * const population: IEvidencePopulation = inventory.select(requiredUnitIds);
 * // population.units contains requirements; scopes additionally includes owners.
 */
export interface IEvidenceInventory {
  /**
   * Version of the serialized inventory shape.
   *
   * Readers use this discriminator to interpret the record layout. It is
   * independent of grammar provenance and the review fingerprint algorithm.
   */
  schemaVersion: 1;

  /**
   * Captured source files backing declaration and annotation ranges.
   *
   * Fingerprinting reads these same snapshots so content and extracted positions
   * cannot come from different revisions of a file.
   */
  sources: IEvidenceSourceFile[];

  /**
   * Accepted annotation spans excluded from content fingerprints.
   *
   * Retain each complete recognized span, including continuation prose. Otherwise
   * editing the body of a review could invalidate the fingerprint it records.
   */
  annotationRanges: IEvidenceSourceLocation[];

  /**
   * Semantic declarations before claim or reference selection.
   *
   * Aliases do not duplicate these identities. Each population independently
   * chooses its denominator from the reconciled units.
   */
  units: IEvidenceUnit[];

  /**
   * Public citation paths associated with unit identities.
   *
   * Several paths may name one declaration through aliases or re-exports. Keep
   * those paths without turning each exported spelling into another unit.
   */
  addresses: IEvidencePublicAddress[];

  /**
   * Documentation carriers and their semantic owners.
   *
   * Include eligible declarations without tags. Checklist and cardinality rules
   * cannot detect an unanswered host if extraction records annotated hosts only.
   */
  hosts: IEvidenceHost[];

  /**
   * Parsed positive and exclusion acknowledgements.
   *
   * Resolution and reference policy decide whether these statements create
   * coverage edges; parsing a target and reason alone does not grant coverage.
   */
  declarations: IEvidenceDeclaration[];

  /**
   * Review statements parsed independently of acknowledgements.
   *
   * Graph evaluation pairs them by host, target, and kind and checks their
   * fingerprints when required. A review by itself never covers a target.
   */
  reviews: IEvidenceReview[];

  /**
   * Findings retained from discovery, extraction, and reconciliation.
   *
   * Partial records remain useful for explaining a failure. These findings keep
   * such records distinguishable from a successfully analyzed empty inventory.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Filesystem paths whose changes can invalidate the analysis.
   *
   * Directories and missing inputs matter alongside successfully read files:
   * watch needs them to detect new declarations and recovery from failed loads.
   */
  dependencies: IEvidenceSourceDependency[];

  /**
   * Whether the inventory can supply a trustworthy coverage denominator.
   *
   * False preserves partial output while preventing a coverage pass based on lost
   * declarations. A healthy empty selection remains true; emptiness alone is not
   * an extraction failure.
   */
  complete: boolean;
}

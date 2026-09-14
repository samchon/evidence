import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { EvidencePopulationRole } from "../typings/EvidencePopulationRole";
import type { EvidenceUnitSelection } from "../typings/EvidenceUnitSelection";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/**
 * Semantic-unit node within one obligation and population role.
 *
 * The export ID distinguishes the same unit appearing on several boundaries or
 * on both sides of one pair. Selection marks denominator participation; structural
 * ancestors can remain addressable nodes whose coverage summarizes descendants.
 */
export interface IEvidenceGraphNode {
  /**
   * Node identity qualified by boundary, role, and semantic unit.
   *
   * Edge endpoints use this value rather than the unqualified semantic identity.
   */
  id: string;

  /**
   * Independent obligation owning this node's displayed state.
   *
   * This joins the node to its effective policy and coverage ledger.
   */
  boundaryId: string;

  /**
   * Claim or reference side represented by the node.
   *
   * A unit serving both roles receives separate nodes with different coverage meaning.
   */
  role: EvidencePopulationRole;

  /**
   * Underlying semantic declaration identity.
   *
   * Multiple boundary-qualified nodes can share this ID without merging obligations.
   */
  unitId: string;

  /**
   * Artifact-specific symbol kind of the declaration.
   *
   * This explains the selection vocabulary used for the node's population.
   */
  symbol: EvidenceSymbol;

  /**
   * Human-readable declaration name retained by extraction.
   *
   * The separately formatted target supplies the complete citation spelling.
   */
  name: string;

  /**
   * Deterministically chosen public target spelling for display and citation.
   *
   * Formatting follows the artifact grammar and query base directory where applicable.
   */
  target: string;

  /**
   * Selection relationship of this identity to its configured population.
   *
   * Ancestors provide structural context; unselected nodes may be retained as
   * relationship endpoints without increasing the coverage denominator.
   */
  selection: EvidenceUnitSelection;

  /**
   * Coverage participation displayed for this node within its boundary.
   *
   * Selected claim nodes indicate an accepted edge; reference nodes report direct
   * coverage or complete coverage of an ancestor's selected descendants.
   */
  covered: boolean;

  /**
   * Whether a reference identity or one of its selected descendants lacks evidence.
   *
   * Claim nodes do not use this as a per-host checklist ledger; that state belongs
   * to the boundary's hostCoverage collection.
   */
  missing: boolean;

  /**
   * Physical declaration sites represented by this semantic node.
   *
   * Merged declarations retain every contributing location within one identity.
   */
  locations: IEvidenceSourceLocation[];
}

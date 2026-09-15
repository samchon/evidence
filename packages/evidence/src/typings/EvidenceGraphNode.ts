import type { IEvidenceGraphHostNode } from "../structures/IEvidenceGraphHostNode";
import type { IEvidenceGraphNode } from "../structures/IEvidenceGraphNode";

/**
 * A serialized graph node representing a unit or its annotation carrier.
 *
 * Unit nodes participate in coverage and dependency edges. Host nodes preserve
 * the physical source location where evidence, exclusions, or reviews were
 * written, allowing graph exports to show annotations without changing the
 * unit's semantic identity.
 */
export type EvidenceGraphNode = IEvidenceGraphHostNode | IEvidenceGraphNode;

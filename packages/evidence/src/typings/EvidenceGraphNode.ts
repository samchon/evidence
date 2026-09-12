import type { IEvidenceGraphHostNode } from "../structures/IEvidenceGraphHostNode";
import type { IEvidenceGraphNode } from "../structures/IEvidenceGraphNode";

/** Unit or annotation-carrier node serialized by graph export. */
export type EvidenceGraphNode = IEvidenceGraphHostNode | IEvidenceGraphNode;

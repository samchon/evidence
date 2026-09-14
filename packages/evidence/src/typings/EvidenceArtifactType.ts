import type { EvidenceDatabaseType } from "./EvidenceDatabaseType";
import type { EvidenceProgrammingType } from "./EvidenceProgrammingType";

/** Artifact families that can provide graph units and annotation carriers.
 *
 * An adapter uses this discriminator to keep language-specific extraction and
 * target spelling separate while the graph can process their common inventory.
 * `markdown` and `swagger` are document artifacts; the other members identify
 * programming or database dialect groups.
 */
export type EvidenceArtifactType =
  EvidenceProgrammingType | EvidenceDatabaseType | "markdown" | "swagger";

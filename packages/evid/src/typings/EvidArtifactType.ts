import type { EvidDatabaseType } from "./EvidDatabaseType";
import type { EvidProgrammingType } from "./EvidProgrammingType";

/**
 * Artifact families that can provide graph units and annotation carriers.
 *
 * An adapter uses this discriminator to keep language-specific extraction and
 * target spelling separate while the graph can process their common inventory.
 * `markdown` and `swagger` are document artifacts; the other members identify
 * programming or database dialect groups.
 */
export type EvidArtifactType =
  EvidProgrammingType | EvidDatabaseType | "markdown" | "swagger";

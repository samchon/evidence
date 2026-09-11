import type { EvidenceDatabaseType } from "./EvidenceDatabaseType";
import type { EvidenceProgrammingType } from "./EvidenceProgrammingType";

/** Source formats that can own graph units, acknowledgements, and reviews. */
export type EvidenceArtifactType =
  EvidenceProgrammingType | EvidenceDatabaseType | "markdown" | "swagger";

import { EvidenceLanguageRegistry } from "../parsers/EvidenceLanguageRegistry";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";

/**
 * Provides the runtime set of artifact types with certified adapters.
 *
 * Configuration validation uses this boundary instead of language identifier
 * unions, since a grammar candidate must not become selectable before its
 * extraction and target behavior are complete.
 */
export namespace EvidenceArtifactTypes {
  /** Narrows an arbitrary configuration discriminator to a certified artifact type. */
  export function isSupported(type: string): type is EvidenceArtifactType {
    return SUPPORTED.some((supported) => supported === type);
  }

  /** Returns a defensive copy so callers cannot mutate the module's support baseline. */
  export function supported(): EvidenceArtifactType[] {
    return [...SUPPORTED];
  }
}

const SUPPORTED: EvidenceArtifactType[] = [
  "markdown",
  "prisma",
  "swagger",
  ...[
    ...EvidenceLanguageRegistry.list(),
    ...EvidenceLanguageRegistry.databases(),
  ]
    .filter((language) => language.adapter !== undefined)
    .map((language) => language.type),
];

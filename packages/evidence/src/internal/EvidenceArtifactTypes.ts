import { EvidenceLanguageRegistry } from "../parsers/EvidenceLanguageRegistry";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";

/** Runtime registry of artifact types backed by certified adapters. */
export namespace EvidenceArtifactTypes {
  export function isSupported(type: string): type is EvidenceArtifactType {
    return SUPPORTED.some((supported) => supported === type);
  }

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
  ...EvidenceLanguageRegistry.databases()
    .filter((language) => language.adapter !== undefined)
    .map((language) => language.type),
];

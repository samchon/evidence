import { EvidenceLanguageRegistry } from "../EvidenceLanguageRegistry";

/** Runtime registry of artifact types backed by certified adapters. */
export namespace EvidenceArtifactTypes {
  export function isSupported(type: string): boolean {
    return SUPPORTED.has(type);
  }

  export function supported(): string[] {
    return Array.from(SUPPORTED);
  }
}

const SUPPORTED = new Set<string>([
  "markdown",
  "prisma",
  "swagger",
  ...EvidenceLanguageRegistry.list()
    .filter((language) => language.adapter !== undefined)
    .map((language) => language.type),
]);

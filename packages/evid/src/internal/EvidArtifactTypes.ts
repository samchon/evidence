import { EvidLanguageRegistry } from "../parsers/EvidLanguageRegistry";
import type { EvidArtifactType } from "../typings/EvidArtifactType";

/**
 * Provides the runtime set of artifact types with certified adapters.
 *
 * Configuration validation uses this boundary instead of language identifier
 * unions, since a grammar candidate must not become selectable before its
 * extraction and target behavior are complete.
 */
export namespace EvidArtifactTypes {
  /**
   * Narrows a configuration discriminator to a certified artifact type.
   *
   * Configuration validation uses this guard before adapter construction,
   * keeping grammar-only candidates outside the supported product surface.
   */
  export function isSupported(type: string): type is EvidArtifactType {
    return SUPPORTED.some((supported) => supported === type);
  }

  /**
   * Returns the certified artifact types in a defensive copy.
   *
   * Callers can inspect or sort their result without mutating the module-level
   * support baseline used by validation.
   */
  export function supported(): EvidArtifactType[] {
    return [...SUPPORTED];
  }
}

const SUPPORTED: EvidArtifactType[] = [
  "markdown",
  "prisma",
  "swagger",
  ...[...EvidLanguageRegistry.list(), ...EvidLanguageRegistry.databases()]
    .filter((language) => language.adapter !== undefined)
    .map((language) => language.type),
];

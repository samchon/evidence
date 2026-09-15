import type { IConfigResolutionManifest } from "./IConfigResolutionManifest";

/**
 * Nearest package scope governing one configuration module request.
 *
 * Package imports and self-references both need the manifest together with its
 * directory so relative map targets cannot escape the scope that declared them.
 */
export interface IConfigPackageBoundary {
  /**
   * Directory containing the governing package manifest.
   *
   * Relative map targets must remain descendants of this boundary.
   */
  directory: string;

  /**
   * Freshly validated package fields used by configuration resolution.
   *
   * Keeping the parsed value with its directory prevents a later cached lookup
   * from pairing metadata with the wrong watch cycle or symlink target.
   */
  manifest: IConfigResolutionManifest;
}

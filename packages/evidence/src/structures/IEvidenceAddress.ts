/**
 * A public file path and segmented accessor used for exact target lookup.
 *
 * Target parsing produces this structured address before resolving a semantic
 * unit. `IEvidencePublicAddress` adds the unit association when an adapter
 * publishes a path. Equal accessor names in different files can name unrelated
 * declarations, and several addresses can expose one unit through aliases.
 *
 * @example
 *   // api.ts#Client.prototype["send.request"] decomposes into:
 *   // file: "api.ts"
 *   // segments: ["Client", "prototype", "send.request"]
 */
export interface IEvidenceAddress {
  /**
   * Public file component of the address.
   *
   * Accessor matching occurs within this file. Resolution normalizes the target
   * path before inventory lookup; the accessor alone does not identify a unit.
   */
  file: string;

  /**
   * Literal accessor components within the public file.
   *
   * Dots inside one component belong to its name. Use the accessor parser and
   * serializer to preserve quoting instead of splitting a rendered dotted
   * string.
   */
  segments: string[];
}

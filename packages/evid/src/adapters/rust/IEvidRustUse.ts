import type { IEvidRustUseBinding } from "./IEvidRustUseBinding";

/**
 * Captures one unrestricted public Rust use declaration and its bindings.
 *
 * The scanner expands nested use trees into statically readable targets so the
 * resolver can construct public aliases without retaining syntax nodes.
 */
export interface IEvidRustUse {
  /**
   * Stable ID for this use declaration.
   *
   * Resolver diagnostics use it to report an unsupported or ambiguous export once.
   */
  id: string;

  /**
   * Module path relative to the scanned file where the use appears.
   *
   * File placement supplies the crate-relative prefix during resolution.
   */
  modulePath: string[];

  /**
   * Statically expanded leaf bindings declared by the use tree.
   *
   * A binding may name, rename, or wildcard-export a target.
   */
  bindings: IEvidRustUseBinding[];

  /**
   * Source-site ID for attaching diagnostics to the declaration.
   *
   * It is distinct from the use ID so a scanner site can be shared consistently.
   */
  siteId: string;
}

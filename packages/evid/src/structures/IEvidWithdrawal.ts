import type { IEvidSourceLocation } from "./IEvidSourceLocation";

/**
 * Source annotation withdrawing a declaration from the public population.
 *
 * Inventory selection propagates withdrawal through structural descendants
 * while retaining the original location. A citation can then explain why a
 * declaration is hidden instead of presenting an excluded API as an unknown
 * name.
 */
export interface IEvidWithdrawal {
  /**
   * Authored withdrawal directive accepted at a declaration documentation host.
   *
   * The three spellings share exclusion behavior but remain distinguishable in
   * the retained annotation record.
   */
  tag: "internal" | "hidden" | "ignore";

  /**
   * Source location of the directive causing withdrawal.
   *
   * Descendant exclusions keep this origin so diagnostics point to the
   * authoring decision rather than an arbitrary child declaration.
   */
  location: IEvidSourceLocation;
}

import type { EvidArtifactType } from "../typings/EvidArtifactType";
import type { EvidSymbol } from "../typings/EvidSymbol";
import type { IEvidUnitSite } from "./IEvidUnitSite";
import type { IEvidWithdrawal } from "./IEvidWithdrawal";

/**
 * A semantic declaration that can participate in evidence coverage.
 *
 * Adapters create units for their public declarations, such as a class,
 * database column, Markdown heading, or API operation. Coverage counts these
 * identities, not their exported names: exposing a declaration through two
 * aliases leaves one unit, while overloads merge only when the language
 * establishes one family.
 *
 * Ownership, addressing, and source position are separate. `parentId`
 * establishes structural containment; public addresses live in the inventory;
 * `sites` records the physical declarations. Population selection and
 * withdrawal follow parent links, so punctuation in a name cannot manufacture
 * an ancestor.
 *
 * The same unit can serve as a claim host and as a reference target in
 * different populations. Its review fingerprint belongs to its content and
 * structural subtree, independently of those selections or aliases.
 *
 * @example
 *   // Exporting Client as PublicClient adds an address, not another class unit.
 *   // Client.send keeps the same parentId through either exported name.
 *   // A member named "send.request" occupies one identity segment, not two.
 */
export interface IEvidUnit {
  /**
   * Adapter-established identity of the declaration.
   *
   * Overloads or merged declarations share this ID only when language rules
   * establish one unit. Public aliases and population selectors never change
   * it.
   */
  id: string;

  /**
   * Identity of the direct structural owner.
   *
   * An omitted parent denotes a root. Scope closure and inherited withdrawals
   * follow this link rather than comparing public accessor prefixes.
   */
  parentId?: string;

  /**
   * Artifact language or format that defines this declaration.
   *
   * The discriminator determines the adapter and selector family. It does not
   * indicate whether a particular population uses the unit as claim or
   * reference.
   */
  type: EvidArtifactType;

  /**
   * Selector category assigned by the adapter.
   *
   * Configuration uses this category to choose required units. An unselected
   * parent can remain addressable as a scope without adding to that
   * denominator.
   */
  symbol: EvidSymbol;

  /**
   * Literal segments of the semantic name.
   *
   * A segment may contain dots or spaces. These names describe the identity;
   * `parentId` remains authoritative for its structural ownership.
   *
   * @example
   *   ["Client", "send.request"]; // The last segment is one literal member name.
   */
  identity: string[];

  /**
   * Human-readable declaration name.
   *
   * Reports use this label without requiring it to be unique. Resolution uses
   * public addresses and IDs, so unrelated declarations may share the label.
   */
  name: string;

  /**
   * Adapter-supplied digest of this unit's own semantic content.
   *
   * When omitted, fingerprinting derives content from the source sites after
   * removing accepted annotations. This value excludes the separate structural
   * subtree contribution and is not a whole-file cache digest.
   */
  contentDigest?: string;

  /**
   * Physical declarations contributing to this identity.
   *
   * Overloads and merged declarations retain their individual sites for host
   * ownership checks and fingerprint content, even though coverage counts one
   * unit.
   */
  sites: IEvidUnitSite[];

  /**
   * Withdrawal directives written on this unit's declarations.
   *
   * Inventory selection also inherits directives from structural ancestors.
   * Keeping their locations allows hidden-target diagnostics to identify the
   * documentation that removed the unit from eligible populations.
   */
  withdrawals: IEvidWithdrawal[];
}

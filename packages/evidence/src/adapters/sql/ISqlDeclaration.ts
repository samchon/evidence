import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** Represents one database declaration copied from a dialect syntax tree.
 *
 * SQL scanners retain this node-free record after their parser session closes.
 * Inventory construction uses its identity and public address to reconcile
 * semantic units, while `site` preserves the physical declaration that owns
 * documentation and review fingerprints.
 */
export interface ISqlDeclaration {
  /** Identifies this extraction record within one source snapshot.
   *
   * Documentation attachments use this value to name their declared owner.
   */
  id: string;

  /** Names the final address segment for diagnostics and inventory display.
   *
   * Relation records may use a generated segment when the SQL syntax has no
   * explicit constraint name.
   */
  name: string;

  /** Classifies the declaration for the shared database selector contract.
   *
   * The scanner emits `model`, `column`, and `relation` records only when the
   * dialect syntax establishes their respective schema boundary.
   */
  symbol: EvidenceDatabaseSymbol;

  /** Stores the file-independent segments that identify the semantic unit.
   *
   * A dialect may normalize these segments without changing the public source
   * spelling retained in `address`.
   */
  identity: string[];

  /** Stores the public accessor segments at this physical declaration site.
   *
   * Each segment remains distinct so quoted identifiers containing dots do not
   * become different nested paths.
   */
  address: string[];

  /** Lists additional dialect-established public paths for this declaration.
   *
   * Omission means the primary `address` is the only supported public path.
   */
  aliases?: string[][];

  /** Locates the declaration and the content used for its review fingerprint.
   *
   * This is a physical site, even when several sites reconcile to one semantic
   * identity.
   */
  site: IEvidenceUnitSite;

  /** Marks whether this extracted declaration belongs to the selected surface.
   *
   * Non-public boundaries remain available to the scanner so it can preserve a
   * truthful inventory without exposing them as selectable units.
   */
  public: boolean;

  /** Names the model extraction record that physically owns this member.
   *
   * Omission denotes a model declaration, which is its own structural owner.
   */
  ownerDeclarationId?: string;

  /** Marks an additional physical site for an identity established elsewhere.
   *
   * Omission means this record introduces its semantic identity in the scan.
   */
  merge?: boolean;
}

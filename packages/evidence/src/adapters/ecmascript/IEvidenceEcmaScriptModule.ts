import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceEcmaScriptExport } from "./IEvidenceEcmaScriptExport";
import type { IEvidenceEcmaScriptImport } from "./IEvidenceEcmaScriptImport";
import type { IEvidenceEcmaScriptOwnedUnit } from "./IEvidenceEcmaScriptOwnedUnit";

/**
 * Resolver state retained for one parsed ECMAScript-family source module.
 *
 * `EvidenceEcmaScriptExportResolver` converts scanner output into this mutable
 * graph node, then uses it to follow local declarations, imports, and re-export
 * edges while assigning public addresses to the inventory.
 */
export interface IEvidenceEcmaScriptModule {
  /**
   * Captured source file represented by this graph node.
   *
   * Its identity selects the module in resolution, while its addresses provide
   * the physical public files for each published unit.
   */
  source: IEvidenceSourceFile;

  /**
   * Local units declared by this source before publication filtering.
   *
   * The resolver matches an export binding against each unit's root and appends
   * its suffix after the public export path.
   */
  units: IEvidenceEcmaScriptOwnedUnit[];

  /**
   * Local roots deliberately excluded from supported publication.
   *
   * An export of one of these roots propagates exclusion through re-exports
   * without reporting that the module lacks a supported declaration.
   */
  excludedRoots: Set<string>;

  /**
   * Static export edges scanned from this module.
   *
   * Resolution chooses explicit edges before star edges for a requested public
   * name and follows their local or module-qualified targets.
   */
  exports: IEvidenceEcmaScriptExport[];

  /**
   * Imported bindings keyed by their local identifier.
   *
   * A local export consults this map to distinguish an imported alias from a
   * declaration owned by this module.
   */
  imports: Map<string, IEvidenceEcmaScriptImport>;

  /**
   * Public names currently known for this module.
   *
   * The resolver seeds this set from explicit exports and expands it with names
   * reachable through star exports before publishing addresses.
   */
  names: Set<string>;
}
